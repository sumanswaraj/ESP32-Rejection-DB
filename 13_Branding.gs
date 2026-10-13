/** Company branding only; no API keys or account settings enter the client. */
function qcFwDefaultBranding_(){return {name:'',logoType:'NONE',logo:'',revision:1};}

function qcFwBrandingRecord_(){
  const rows=qcFwRead_('Config').filter(r=>r.Setting==='Company_Branding_JSON');
  qcFwAssert_(rows.length<=1,'BRANDING_CONFIGURATION_DUPLICATE');
  if(!rows.length)return {row:null,brand:Object.assign(qcFwDefaultBranding_(),{revision:0})};
  let brand;try{brand=JSON.parse(String(rows[0].Value));}catch(e){throw new Error('BRANDING_CONFIGURATION_INVALID: review Company_Branding_JSON in Config');}
  qcFwAssert_(brand&&typeof brand==='object'&&typeof brand.name==='string'&&typeof brand.logo==='string'&&
    ['NONE','IMAGE','SVG','URL'].includes(brand.logoType)&&Number.isSafeInteger(brand.revision)&&brand.revision>=1,'BRANDING_CONFIGURATION_INVALID');
  return {row:rows[0],brand};
}

function qcFwPublicBranding_(brand){return {name:brand.name,logoType:brand.logoType,logo:brand.logo,revision:brand.revision};}

function qcFwLogo_(type,value){
  qcFwAssert_(['NONE','IMAGE','SVG','URL'].includes(type),'LOGO_TYPE_INVALID');
  if(type==='NONE')return '';
  const logo=qcFwText_(value,'LOGO',type==='URL'?2048:type==='SVG'?28000:39000,true);
  if(type==='URL'){
    qcFwAssert_(/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?(?:[/?#][^\s<>"'\\]*)?$/i.test(logo),'LOGO_URL_INVALID: use a direct HTTPS image URL');
  }else if(type==='IMAGE'){
    const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(logo);
    qcFwAssert_(match,'LOGO_IMAGE_INVALID: use PNG, JPG or WebP');
    let bytes;try{bytes=Utilities.base64Decode(match[2]).map(b=>(b+256)%256);}catch(e){throw new Error('LOGO_IMAGE_INVALID');}
    qcFwAssert_(bytes.length<=28672,'LOGO_IMAGE_TOO_LARGE: upload a file up to 28 KB or use an HTTPS URL');
    const prefix=(values,offset=0)=>values.every((v,i)=>bytes[offset+i]===v);
    qcFwAssert_(match[1]==='png'?prefix([137,80,78,71,13,10,26,10]):match[1]==='jpeg'?prefix([255,216,255]):prefix([82,73,70,70])&&prefix([87,69,66,80],8),'LOGO_IMAGE_INVALID');
  }else qcFwSvgLogo_(logo);
  return logo;
}

function qcFwSvgLogo_(svg){
  // Reject document types/entities before XML parsing. Logos are displayed as
  // isolated images; no supplied SVG is inserted into the portal's DOM as HTML.
  const content=svg.replace(/^<\?xml\s[^?]*\?>\s*/i,'');
  qcFwAssert_(!/<!DOCTYPE|<!ENTITY|<\?/i.test(content),'SVG_LOGO_INVALID: document types, entities and processing instructions are not supported');
  let root;try{root=XmlService.parse(content).getRootElement();}catch(e){throw new Error('SVG_LOGO_INVALID: paste valid SVG code');}
  qcFwAssert_(root.getName()==='svg'&&root.getNamespace().getURI()==='http://www.w3.org/2000/svg','SVG_LOGO_INVALID: the svg element needs xmlns="http://www.w3.org/2000/svg"');
  const allowed=['svg','g','defs','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','title','desc','clipPath','mask','linearGradient','radialGradient','stop','pattern','symbol','use','filter','feGaussianBlur','feOffset','feBlend','feColorMatrix','feComponentTransfer','feFuncR','feFuncG','feFuncB','feFuncA','feComposite','feFlood','feMerge','feMergeNode','feDropShadow'];
  let count=0;
  const visit=(el,depth)=>{
    qcFwAssert_(++count<=1500&&depth<=40,'SVG_LOGO_TOO_COMPLEX');
    qcFwAssert_(allowed.includes(el.getName())&&el.getNamespace().getURI()==='http://www.w3.org/2000/svg','SVG_LOGO_INVALID: use shapes, text, paths and internal gradients; scripts, external images and animation are not supported');
    el.getAttributes().forEach(attr=>{
      const name=attr.getName().toLowerCase(),value=attr.getValue();
      qcFwAssert_(!/^on/.test(name)&&!['src','base'].includes(name),'SVG_LOGO_INVALID: active attributes are not supported');
      if(name==='href')qcFwAssert_(/^#[A-Za-z_][A-Za-z0-9_.:-]*$/.test(value),'SVG_LOGO_INVALID: references must stay inside the logo');
      if(name==='style')qcFwAssert_(!/[\\@{}<>]/.test(value)&&!/expression\s*\(|javascript\s*:/i.test(value),'SVG_LOGO_INVALID: active CSS is not supported');
      const withoutInternalUrls=value.replace(/url\(\s*['"]?#[A-Za-z_][A-Za-z0-9_.:-]*['"]?\s*\)/gi,'');
      qcFwAssert_(!/url\s*\(/i.test(withoutInternalUrls),'SVG_LOGO_INVALID: external resources are not supported');
    });
    el.getChildren().forEach(child=>visit(child,depth+1));
  };visit(root,0);
}

function qcFwBrandingUpdate_(request,actor){
  qcFwAssert_(['OWNER','ADMIN'].includes(actor.role),'FORBIDDEN');
  const name=qcFwText_(request.name,'COMPANY_NAME',120,false),logoType=request.logo_type,logo=qcFwLogo_(logoType,request.logo);
  const {row,brand}=qcFwBrandingRecord_();qcFwAssert_(row,'SETUP_UPDATE_REQUIRED: run setupRejectionLogger to add company settings');
  const meta=qcFwRequestMeta_(request,actor,'BRANDING_UPDATE',{name,logoType,logo,revision:request.revision});
  if(brand.lastRequestId===meta.id){qcFwAssert_(brand.lastRequestHash===meta.hash,'REQUEST_ID_PAYLOAD_CONFLICT');return {success:true,branding:qcFwPublicBranding_(brand),message:'Company settings already saved.'};}
  qcFwAssert_(request.revision===brand.revision,'REVISION_CONFLICT: refresh company settings and try again');
  const updated={name,logoType,logo,revision:brand.revision+1,lastRequestId:meta.id,lastRequestHash:meta.hash,updatedBy:actor.userId,updatedAt:new Date().toISOString()};
  const json=JSON.stringify(updated);qcFwAssert_(json.length<47000,'BRANDING_TOO_LARGE');
  // A single Config cell is the commit point for name, logo and retry metadata.
  qcFwUpdate_('Config',row,{Value:json});
  qcFwAudit_(actor,'BRANDING_UPDATE','COMPANY','BRANDING',['Company_Name','Company_Logo'],meta.id);
  return {success:true,branding:qcFwPublicBranding_(updated),message:'Company name and logo saved.'};
}

/** Escape JSON for the only force-printed boot script, including </script>. */
function qcFwHtmlJson_(value){return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));}

function qcFwPageBranding_(){
  try{
    if(PropertiesService.getScriptProperties().getProperty('QC_BOOK_ID'))return qcFwPublicBranding_(qcFwBrandingRecord_().brand);
  }catch(e){console.warn('Company branding could not be loaded; review Config.');}
  return qcFwPublicBranding_(qcFwDefaultBranding_());
}
