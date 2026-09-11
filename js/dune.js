/* dune.js — faceted island banner reading the live site theme.
   Recolors via MutationObserver on <html data-theme>; pauses offscreen;
   hides itself if three.js or WebGL is unavailable. */
(function(){
  var canvas = document.getElementById("dune");
  if(!canvas || !window.THREE) { if(canvas) canvas.parentNode.style.display = "none"; return; }
  var root = document.documentElement;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true, alpha:false});
  } catch(e) { canvas.parentNode.style.display = "none"; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(38, 2, 0.1, 60);
  cam.position.set(0, 2.6, 8.2);
  cam.lookAt(0, 0.1, -0.5);

  var cDim = new THREE.Color(), cInk = new THREE.Color(),
      cBri = new THREE.Color(), cAcc = new THREE.Color(), tmp = new THREE.Color();
  function css(v){ return getComputedStyle(root).getPropertyValue(v).trim(); }
  function nonIndexed(geo){ return geo.index ? geo.toNonIndexed() : geo; }
  function varyFor(face){ return 0.9 + 0.1*(((face*2654435761)%100+100)%100)/100; }
  function addFacetColors(geo){
    var arr = new Float32Array(geo.attributes.position.count*3);
    geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return arr;
  }

  /* stepped sea, per-face colors: dim troughs, ink swells, bright whitecaps */
  var sg = nonIndexed(new THREE.PlaneGeometry(17, 7, 14, 6));
  sg.rotateX(-Math.PI/2);
  var sp = sg.attributes.position, NV = sp.count, NF = NV/3, i;
  var sbase = new Float32Array(NV*2);
  for(i=0;i<NV;i++){ sbase[i*2]=sp.array[i*3]; sbase[i*2+1]=sp.array[i*3+2]; }
  var scols = addFacetColors(sg);
  var sea = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({vertexColors:true}));
  sea.position.z = -1;
  scene.add(sea);
  function waveH(x, z, t){
    var h = 0.45*Math.sin(x*0.7 + t*0.9) + 0.3*Math.sin(z*1.1 - t*0.7) + 0.2*Math.sin((x+z)*0.5 + t*0.5);
    return Math.round(h*2.5)/2.5;
  }
  function paintSea(t){
    var f, v, h, cx, cz, k;
    for(f=0;f<NF;f++){
      cx = (sbase[f*6]+sbase[f*6+2]+sbase[f*6+4])/3;
      cz = (sbase[f*6+1]+sbase[f*6+3]+sbase[f*6+5])/3;
      h = waveH(cx, cz, t);
      for(v=0;v<3;v++){ sp.array[(f*3+v)*3+1] = h; }
      k = (h+0.95)/1.9;
      if(k<0)k=0; if(k>1)k=1;
      tmp.copy(cDim).lerp(cInk, k);
      if(k>0.8) tmp.lerp(cBri, (k-0.8)*2.4);
      tmp.multiplyScalar(varyFor(f));
      for(v=0;v<3;v++){ scols[(f*3+v)*3]=tmp.r; scols[(f*3+v)*3+1]=tmp.g; scols[(f*3+v)*3+2]=tmp.b; }
    }
    sp.needsUpdate = true;
    sg.attributes.color.needsUpdate = true;
  }

  /* islands: icosahedron rock + cone grass cap, per-face shaded, inked rims */
  var outlineMat = new THREE.MeshBasicMaterial({color:0x1c1713, side:THREE.BackSide});
  function faceted(geo, base){
    geo = nonIndexed(geo);
    var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({vertexColors:true}));
    mesh.userData = {arr:addFacetColors(geo), n:geo.attributes.position.count, base:base};
    return mesh;
  }
  function paintFaceted(mesh){
    var col = mesh.userData.base === "rock" ? cInk : cBri;
    for(var f=0; f<mesh.userData.n/3; f++){
      tmp.copy(col).multiplyScalar(varyFor(f+7));
      for(var v=0;v<3;v++){
        mesh.userData.arr[(f*3+v)*3]=tmp.r;
        mesh.userData.arr[(f*3+v)*3+1]=tmp.g;
        mesh.userData.arr[(f*3+v)*3+2]=tmp.b;
      }
    }
    mesh.geometry.attributes.color.needsUpdate = true;
  }
  function rimmed(mesh){
    var o = new THREE.Mesh(mesh.geometry, outlineMat);
    o.position.copy(mesh.position);
    o.rotation.copy(mesh.rotation);
    o.scale.copy(mesh.scale).multiplyScalar(1.07);
    return o;
  }
  function island(r, px, pz){
    var grp = new THREE.Group();
    var rock = faceted(new THREE.IcosahedronGeometry(r, 0), "rock");
    rock.scale.y = 0.75;
    rock.position.y = r*0.15;
    rock.rotation.y = px;
    var grass = faceted(new THREE.ConeGeometry(r*0.62, r*0.5, 6), "grass");
    grass.position.y = r*0.62;
    grass.rotation.y = pz;
    grp.add(rimmed(rock)); grp.add(rock);
    grp.add(rimmed(grass)); grp.add(grass);
    grp.position.set(px, 0, pz);
    grp.userData = {rock:rock, grass:grass, ph:px*1.7+pz, r:r};
    scene.add(grp);
    return grp;
  }
  var isles = [island(0.9, -3.4, -2.2), island(0.55, 3.1, -2.8)];

  /* shore foam rings */
  var foams = [];
  isles.forEach(function(g, idx){
    for(var fi=0; fi<2; fi++){
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(g.userData.r*(1.15+fi*0.3), g.userData.r*(1.3+fi*0.3), 24),
        new THREE.MeshBasicMaterial({transparent:true, opacity:0.6, side:THREE.DoubleSide})
      );
      ring.rotation.x = -Math.PI/2;
      ring.position.set(g.position.x, 0.15, g.position.z);
      ring.userData = {ph:idx*2+fi*1.4};
      scene.add(ring); foams.push(ring);
    }
  });

  /* cube clouds */
  function cloud(px, py, pz, s){
    var grp = new THREE.Group();
    var m = new THREE.MeshBasicMaterial();
    [[0,0,0,1.1,0.55,0.7],[0.8,0.1,0.1,0.7,0.45,0.6],[-0.8,0.05,-0.1,0.75,0.4,0.6]].forEach(function(b){
      var box = new THREE.Mesh(new THREE.BoxGeometry(b[3]*s, b[4]*s, b[5]*s), m);
      box.position.set(b[0]*s, b[1]*s, b[2]*s);
      grp.add(box);
    });
    grp.position.set(px, py, pz);
    grp.userData = {mat:m, speed:0.12+Math.random()*0.1};
    scene.add(grp);
    return grp;
  }
  var clouds = [cloud(-4, 2.6, -4, 1), cloud(1.5, 3.1, -5, 0.7), cloud(4.5, 2.4, -3.5, 0.85)];

  /* flat accent sun with inked backing disc */
  var sunBack = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), outlineMat);
  sunBack.position.set(-2.6, 2.9, -7.01);
  scene.add(sunBack);
  var sun = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({fog:false}));
  sun.position.set(-2.6, 2.9, -7);
  scene.add(sun);

  function applyTheme(){
    var bg = new THREE.Color(css("--bg"));
    scene.background = bg;
    cDim.set(css("--dim")); cInk.set(css("--ink"));
    cBri.set(css("--bright")); cAcc.set(css("--accent"));
    isles.forEach(function(g){ paintFaceted(g.userData.rock); paintFaceted(g.userData.grass); });
    clouds.forEach(function(c){ c.userData.mat.color.copy(cBri); });
    foams.forEach(function(f){ f.material.color.copy(cBri); });
    sun.material.color.copy(cAcc);
    paintSea(0);
  }
  /* follow the site's own theme picker (sets data-theme directly, no events) */
  new MutationObserver(function(muts){
    muts.forEach(function(m){ if(m.attributeName === "data-theme") applyTheme(); });
  }).observe(root, {attributes:true, attributeFilter:["data-theme"]});

  function resize(){
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if(w&&h){ renderer.setSize(w, h, false); cam.aspect = w/h; cam.updateProjectionMatrix(); }
  }
  window.addEventListener("resize", resize);
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pqx = 0, pqy = 0, ptx = 0, pty = 0;
  canvas.addEventListener("pointermove", function(e){
    var r = canvas.getBoundingClientRect();
    ptx = ((e.clientX - r.left)/r.width - 0.5)*2;
    pty = ((e.clientY - r.top)/r.height - 0.5)*2;
  });
  canvas.addEventListener("pointerleave", function(){ ptx = 0; pty = 0; });
  var visible = true;
  if("IntersectionObserver" in window){
    new IntersectionObserver(function(es){ visible = es[0].isIntersecting; }).observe(canvas);
  }
  var t0 = performance.now();
  function frame(now){
    if(visible && !document.hidden){
      var t = (now-t0)/1000;
      paintSea(t);
      isles.forEach(function(g){
        g.position.y = Math.round(Math.sin(t*0.8+g.userData.ph)*3)/3*0.08;
        g.rotation.y += 0.0006;
      });
      clouds.forEach(function(c){
        c.position.x += c.userData.speed*0.016;
        if(c.position.x > 8) c.position.x = -8;
      });
      foams.forEach(function(f){
        var k = 1 + Math.sin(t*1.2+f.userData.ph)*0.07;
        f.scale.set(k, k, 1);
        f.material.opacity = 0.45 + Math.sin(t*1.2+f.userData.ph)*0.15;
      });
      pqx += (ptx-pqx)*0.05; pqy += (pty-pqy)*0.05;
      if(!reduced){
        cam.position.x = pqx*1.1;
        cam.position.y = 2.6 - pqy*0.5;
        cam.lookAt(pqx*0.4, 0.1, -0.5);
      }
      renderer.render(scene, cam);
    }
    if(!reduced) requestAnimationFrame(frame);
  }
  applyTheme(); resize(); requestAnimationFrame(frame);
})();
