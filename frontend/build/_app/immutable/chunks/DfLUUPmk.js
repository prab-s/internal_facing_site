function I(e,l,t,a){const r=Number(e);return Number.isNaN(r)?a:Math.max(l,Math.min(t,r))}function C(e,l){const t=String(e||"").replace("#",""),a=t.length===3?t.split("").map(i=>i+i).join(""):t.padEnd(6,"0"),r=I(l,0,100,100)/100,o=Number.parseInt(a,16),n=o>>16&255,c=o>>8&255,s=o&255;return`rgba(${n}, ${c}, ${s}, ${r})`}function R(e,l,t){return`#${[e,l,t].map(a=>Number(a).toString(16).padStart(2,"0")).join("")}`}function H(e){var y,p,d,g,q,$,M,L,T,E,N;const l=((y=e.querySelector('[data-gradient-field="type"]'))==null?void 0:y.value)||"linear",t=((p=e.querySelector('[data-gradient-field="angle"]'))==null?void 0:p.value)||"135",a=((d=e.querySelector('[data-gradient-field="direction"]'))==null?void 0:d.value)||"",r=((g=e.querySelector('[data-gradient-field="radialShape"]'))==null?void 0:g.value)||"circle",o=((q=e.querySelector('[data-gradient-field="radialPosition"]'))==null?void 0:q.value)||"center",n=(($=e.querySelector('[data-gradient-field="colour1"]'))==null?void 0:$.value)||"#ffffff",c=((M=e.querySelector('[data-gradient-field="opacity1"]'))==null?void 0:M.value)||"100",s=((L=e.querySelector('[data-gradient-field="stop1"]'))==null?void 0:L.value)||"0",i=((T=e.querySelector('[data-gradient-field="colour2"]'))==null?void 0:T.value)||"#000000",m=((E=e.querySelector('[data-gradient-field="opacity2"]'))==null?void 0:E.value)||"100",b=((N=e.querySelector('[data-gradient-field="stop2"]'))==null?void 0:N.value)||"100",S=C(n,c),h=C(i,m);return l==="radial"?`radial-gradient(${r} at ${o}, ${S} ${s}%, ${h} ${b}%)`:`linear-gradient(${a||`${t}deg`}, ${S} ${s}%, ${h} ${b}%)`}function u(e,l,t){const a=e.querySelector(`[data-gradient-field="${l}"]`);a&&t!==void 0&&t!==null&&(a.value=t)}function x(e,l,t,a,r,o){const n=String(e||"").match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/);if(n){const s=n[1],i=n[2],m=n[3],b=n[4]!==void 0?Number(n[4]):1;u(t,a,R(s,i,m)),u(t,r,Math.round(b*100)),u(t,o,l);return}const c=String(e||"").match(/#[0-9a-fA-F]{3,8}/);c&&(u(t,a,c[0]),u(t,r,100),u(t,o,l))}function F(e,l){if(!l)return;const t="(rgba?\\([^)]*\\)|#[0-9a-fA-F]{3,8})\\s+(\\d+)%",a=new RegExp(`linear-gradient\\((.*?),\\s*${t}\\s*,\\s*${t}\\s*\\)`),r=String(l).match(a);if(r){const c=r[1];u(e,"type","linear"),c.endsWith("deg")?(u(e,"direction",""),u(e,"angle",c.replace("deg",""))):u(e,"direction",c),x(r[2],r[3],e,"colour1","opacity1","stop1"),x(r[4],r[5],e,"colour2","opacity2","stop2");return}const o=new RegExp(`radial-gradient\\((circle|ellipse)\\s+at\\s+(.*?),\\s*${t}\\s*,\\s*${t}\\s*\\)`),n=String(l).match(o);n&&(u(e,"type","radial"),u(e,"radialShape",n[1]),u(e,"radialPosition",n[2]),x(n[3],n[4],e,"colour1","opacity1","stop1"),x(n[5],n[6],e,"colour2","opacity2","stop2"))}function D(e){const l=()=>{var n,c;const t=(n=[...document.querySelectorAll(".gjs-sm-sector")].find(s=>s.textContent.includes("Advanced Gradient")))==null?void 0:n.querySelector(".gjs-sm-properties");if(!t||t.querySelector("[data-gradient-builder]"))return;const a=document.createElement("div");a.setAttribute("data-gradient-builder","true"),a.style.padding="8px",a.style.width="100%",a.style.boxSizing="border-box",a.innerHTML=`
      <div class="vstack gap-2">
        <label class="form-label mb-0">Gradient type</label>
        <select class="form-select form-select-sm" data-gradient-field="type">
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
        <div class="row g-2">
          <div class="col-6">
            <label class="form-label mb-0">Angle</label>
            <input class="form-control form-control-sm" type="number" data-gradient-field="angle" value="135" />
          </div>
          <div class="col-6">
            <label class="form-label mb-0">Direction</label>
            <input class="form-control form-control-sm" data-gradient-field="direction" />
          </div>
        </div>
        <div class="row g-2">
          <div class="col-6">
            <label class="form-label mb-0">Radial shape</label>
            <select class="form-select form-select-sm" data-gradient-field="radialShape">
              <option value="circle">Circle</option>
              <option value="ellipse">Ellipse</option>
            </select>
          </div>
          <div class="col-6">
            <label class="form-label mb-0">Radial position</label>
            <input class="form-control form-control-sm" data-gradient-field="radialPosition" value="center" />
          </div>
        </div>
        <div class="row g-2">
          <div class="col-4">
            <label class="form-label mb-0">Colour 1</label>
            <input class="form-control form-control-color w-100" type="color" data-gradient-field="colour1" value="#ffffff" />
          </div>
          <div class="col-4">
            <label class="form-label mb-0">Opacity 1</label>
            <input class="form-control form-control-sm" type="number" min="0" max="100" step="1" data-gradient-field="opacity1" value="100" />
          </div>
          <div class="col-4">
            <label class="form-label mb-0">Stop 1</label>
            <input class="form-control form-control-sm" type="number" min="0" max="100" step="1" data-gradient-field="stop1" value="0" />
          </div>
        </div>
        <div class="row g-2">
          <div class="col-4">
            <label class="form-label mb-0">Colour 2</label>
            <input class="form-control form-control-color w-100" type="color" data-gradient-field="colour2" value="#000000" />
          </div>
          <div class="col-4">
            <label class="form-label mb-0">Opacity 2</label>
            <input class="form-control form-control-sm" type="number" min="0" max="100" step="1" data-gradient-field="opacity2" value="100" />
          </div>
          <div class="col-4">
            <label class="form-label mb-0">Stop 2</label>
            <input class="form-control form-control-sm" type="number" min="0" max="100" step="1" data-gradient-field="stop2" value="100" />
          </div>
        </div>
        <label class="form-label mb-0">Generated CSS</label>
        <input class="form-control form-control-sm" data-gradient-output readonly />
        <button type="button" class="btn btn-sm btn-outline-primary" data-gradient-apply>Apply Gradient</button>
      </div>
    `,t.appendChild(a);const r=()=>{const s=a.querySelector("[data-gradient-output]");s&&(s.value=H(a))};a.querySelectorAll("input, select").forEach(s=>{s.addEventListener("input",r),s.addEventListener("change",r)}),(c=a.querySelector("[data-gradient-apply]"))==null||c.addEventListener("click",()=>{const s=e.getSelected();if(!s){window.alert("Select an element first.");return}const i=H(a);s.addStyle({"background-image":i}),e.refresh(),r()});const o=e.getSelected();if(o){const i=o.getStyle()["background-image"]||"";i&&F(a,i)}r()};e.StyleManager.addSector("advanced-gradient",{name:"Advanced Gradient",open:!0,properties:[{name:"Background image",property:"background-image",type:"text",full:!0,defaults:""}]}),e.on("style:target",()=>{window.setTimeout(l,100)}),e.on("component:selected",()=>{window.setTimeout(l,100)}),e.on("load",()=>{window.setTimeout(l,300)})}function A(e){return String(e||"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;")}function G(){var e;return(e=[...document.querySelectorAll(".gjs-sm-sector")].find(l=>l.textContent.includes("HTML Attributes")))==null?void 0:e.querySelector(".gjs-sm-properties")}function v(e,l,t){const a=e.querySelector(`[data-html-attr-field="${l}"]`);a&&t!==void 0&&t!==null&&(a.value=t)}function k(e){const l=e.querySelector('[data-sm-property="data-gjs-attr-editor-placeholder"]');l&&(l.style.display="none")}function w(e,l){var c;const t=l.getSelected();if(!t)return;const a=t.getAttributes(),r=t.get("tagName")||"",o=String(r||"").toLowerCase()==="img"||((c=t.is)==null?void 0:c.call(t,"image"));v(e,"tag",r),v(e,"src",a.src||""),v(e,"href",a.href||""),v(e,"alt",a.alt||""),v(e,"title",a.title||""),v(e,"target",a.target||"");const n=e.querySelector("[data-html-attr-upload-image]");n&&(n.hidden=!o)}function P(e="image/*"){return new Promise(l=>{const t=document.createElement("input");t.type="file",t.accept=e,t.addEventListener("change",()=>{var o;const a=(o=t.files)==null?void 0:o[0];if(!a){l(null);return}const r=new FileReader;r.onload=()=>{l({file:a,dataUrl:r.result})},r.readAsDataURL(a)}),t.click()})}function j(e,l,t={}){var S,h;const a=typeof t.uploadImageAsset=="function"?t.uploadImageAsset:null,r=l.getSelected();if(!r)return;if(e.querySelector("[data-html-attribute-builder]")){k(e),w(e,l);return}const n=r.getAttributes(),c=r.get("tagName")||"",s=String(c||"").toLowerCase()==="img"||((S=r.is)==null?void 0:S.call(r,"image"));k(e);const i=document.createElement("div");i.setAttribute("data-html-attribute-builder","true"),i.style.padding="8px",i.style.width="100%",i.style.boxSizing="border-box",i.innerHTML=`
    <div class="vstack gap-2">
      <div class="small text-body-secondary">
        Edit the selected component's HTML attributes without leaving the canvas.
      </div>

      <label class="form-label mb-0">Tag</label>
      <input class="form-control form-control-sm" data-html-attr-field="tag" readonly value="${A(c)}">

      <label class="form-label mb-0">src</label>
      <input class="form-control form-control-sm" data-html-attr-field="src" value="${A(n.src||"")}">
      <button type="button" class="btn btn-sm btn-outline-secondary" data-html-attr-upload-image>
        Choose Image File
      </button>

      <label class="form-label mb-0">href</label>
      <input class="form-control form-control-sm" data-html-attr-field="href" value="${A(n.href||"")}">

      <label class="form-label mb-0">alt</label>
      <input class="form-control form-control-sm" data-html-attr-field="alt" value="${A(n.alt||"")}">

      <label class="form-label mb-0">title</label>
      <input class="form-control form-control-sm" data-html-attr-field="title" value="${A(n.title||"")}">

      <label class="form-label mb-0">target</label>
      <select class="form-select form-select-sm" data-html-attr-field="target">
        <option value="">Same tab</option>
        <option value="_blank">New tab</option>
      </select>

      <button type="button" class="btn btn-sm btn-outline-primary" data-html-attr-apply>
        Apply HTML Attributes
      </button>
    </div>
  `,e.appendChild(i);const m=i.querySelector("[data-html-attr-upload-image]");m&&(m.hidden=!s||!a);const b=i.querySelector('[data-html-attr-field="target"]');b&&(b.value=n.target||""),(h=i.querySelector("[data-html-attr-apply]"))==null||h.addEventListener("click",()=>{const f=l.getSelected();if(!f)return;const y={...f.getAttributes()};i.querySelectorAll("[data-html-attr-field]").forEach(p=>{const d=p.getAttribute("data-html-attr-field");if(!d||d==="tag")return;const g=p.value.trim();g?y[d]=g:delete y[d]}),f.setAttributes(y),l.StyleManager.render(),l.refresh(),w(e,l)}),m==null||m.addEventListener("click",async()=>{if(!a)return;const f=l.getSelected();if(!f){alert("Select an image first.");return}if(String(f.get("tagName")||"").toLowerCase()!=="img"){alert("Select an image element first.");return}const p=await P("image/*");if(!p)return;const d=await a(p.file,p.dataUrl);if(!(d!=null&&d.file_url)){alert("Image upload failed");return}const g=i.querySelector('[data-html-attr-field="src"]');g&&(g.value=d.file_url),f.setAttributes({...f.getAttributes(),src:d.file_url}),l.StyleManager.render(),l.refresh(),w(e,l)})}function U(e,l={}){const t=()=>{window.setTimeout(()=>{const a=G();a&&j(a,e,l)},100)};e.StyleManager.addSector("html-attributes",{name:"HTML Attributes",open:!0,properties:[{name:"Selected element",property:"data-gjs-attr-editor-placeholder",type:"text",defaults:"",full:!0}]}),e.StyleManager.render(),e.on("component:selected",t),e.on("style:target",t),e.on("load",t),t()}export{U as a,D as i};
