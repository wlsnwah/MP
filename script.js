import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';


// Add this near your renderer setup:
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

// Function to create text label (no box)
function createLabel(text, position) {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.color = '#fff'; // dark text for white background
  div.style.fontSize = '10px';
  div.style.fontWeight = '700';
  div.style.textShadow = '1px 1px 2px rgba(255,255,255,0.7)';
  div.style.whiteSpace = 'nowrap';

  const label = new CSS2DObject(div);
  label.position.copy(position);
  scene.add(label);
  return label;
}

// function loadGDLModel(yPos, name, callback) {
//   const loader = new STLLoader();
//   loader.load('/stack_holder.stl', (geometry) => {

//     const material = new THREE.MeshStandardMaterial({
//       color: 0x4444ff,
//       roughness: 0.8,
//       metalness: 0.2
//     });

//     const mesh = new THREE.Mesh(geometry, material);

//     mesh.scale.set(0.01, 0.01, 0.01);
//     mesh.position.y = yPos;
//     mesh.name = name;

//     scene.add(mesh);
//     callback(mesh);
//   });
// }

function loadGDLModel(yPos, name, callback) {
  const loader = new GLTFLoader();
  loader.load('/gdl_model.glb', (gltf) => {
    const mesh = gltf.scene;

    // Optional: scale and position
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    mesh.scale.set(0.075, 0.075, 0.075); 

    // FIX ORIENTATION (Z-up → Y-up)
    mesh.rotation.x = -Math.PI / 2;

    mesh.position.y = yPos;
    mesh.name = name;

    scene.add(mesh);
    callback(mesh);
  }, undefined, (error) => {
    console.error('Error loading GLB:', error);
  });
}



// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0e0e);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(3, 3, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Helper function to create layers
function createLayer(width, height, depth, color, yPos, name) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = yPos;
  mesh.name = name;
  scene.add(mesh);
  return mesh;
}

function createGraphitePlate(width, height, depth, color, yPos, name) {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 })
  );
  group.add(base);

  // Visible grooves
  for (let i = -1; i <= 1; i++) {
    const groove = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.9, height * 1.01, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x0d0d0d })
    );
    groove.position.set(0, 0, i * 0.45);
    group.add(groove);
  }

  group.position.y = yPos;
  group.name = name;
  scene.add(group);
  return group;
}


// Catalyst-Coated Membrane (thin transparent layer)
function createMembrane(width, height, depth, yPos, name) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffcccc,
    transparent: true,
    opacity: 0.6
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = yPos;
  mesh.name = name;
  scene.add(mesh);
  return mesh;
}

// Improved Gasket (thin ring frame)
function createGasket(width, height, depth, color, yPos, name) {
  const outer = new THREE.BoxGeometry(width, height, depth);
  const inner = new THREE.BoxGeometry(width * 0.8, height * 1.1, depth * 0.8);

  // Boolean subtract using THREE shape group
  const outerMesh = new THREE.Mesh(outer);
  const innerMesh = new THREE.Mesh(inner);
  const gasketGroup = new THREE.Group();

  outerMesh.material = new THREE.MeshStandardMaterial({ color });
  innerMesh.material = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0 });

  gasketGroup.add(outerMesh);
  gasketGroup.add(innerMesh);
  gasketGroup.position.y = yPos;
  gasketGroup.name = name;
  scene.add(gasketGroup);

  return gasketGroup;
}

// ✅ Improved Frame / End Plate (with inlet/outlet holes)
function createFrame(width, height, depth, color, yPos, name) {
  const group = new THREE.Group();

  const plateGeometry = new THREE.BoxGeometry(width, height, depth);
  const plateMaterial = new THREE.MeshStandardMaterial({ color });
  const plate = new THREE.Mesh(plateGeometry, plateMaterial);
  group.add(plate);

  // Inlet/outlet circular holes (visually represented as black cylinders)
  const holeGeometry = new THREE.CylinderGeometry(0.25, 0.25, height + 0.01, 32);
  const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });

  const inlet = new THREE.Mesh(holeGeometry, holeMaterial);
  inlet.position.set(1, 0, 1);
  inlet.rotation.z = Math.PI / 2;
  group.add(inlet);

  const outlet = new THREE.Mesh(holeGeometry, holeMaterial);
  outlet.position.set(-1, 0, -1);
  outlet.rotation.z = Math.PI / 2;
  group.add(outlet);

  group.position.y = yPos;
  group.name = name;
  scene.add(group);
  return group;
}

// ✅ Improved Gas Diffusion Layer (perforated texture / carbon mesh look)
function createGDL(width, height, depth, color, yPos, name) {
  const group = new THREE.Group();

  // Tiny bumps/holes to simulate porous material
  const baseGeometry = new THREE.BoxGeometry(width, height, depth);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.2
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  group.add(base);

  // Add small black circles as pores
  for (let x = -1; x <= 1; x += 1) {
    for (let z = -1; z <= 1; z += 1) {
      const pore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, height + 0.01, 16),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
      );
      pore.position.set(x, 0, z);
      pore.rotation.z = Math.PI / 2;
      group.add(pore);
    }
  }

  group.position.y = yPos;
  group.name = name;
  scene.add(group);
  return group;
}

// Starting Y position
let currentY = 0;

// Layer thickness
const thickness = {
  frame: 0.25,
  collector: 0.15,
  graphite: 0.15,
  gasket: 0.08,
  gdl: 0.1,
  ccm: 0.12
};

// Stack colors
const color = {
  frame: 0x606060,
  collector: 0xffb84d,
  graphite: 0x1a1a1a,
  gasket: 0x00ffff,
  gdl: 0x4444ff,
  ccm: 0xff4d4d
};

// Width (smaller in the middle for realism)
const width = 3;
const depth = 3;

// Create stack (top to bottom)
const layers = [
  { type: 'Frame / End Plate', color: color.frame, h: thickness.frame },
  { type: 'Current Collector', color: color.collector, h: thickness.collector },
  { type: 'Graphite Plate', color: color.graphite, h: thickness.graphite },
  { type: 'Gasket', color: color.gasket, h: thickness.gasket },
  { type: 'Gas Diffusion Layer', color: color.gdl, h: thickness.gdl },
  { type: 'Catalyst-Coated Membrane', color: color.ccm, h: thickness.ccm },
  { type: 'Gas Diffusion Layer', color: color.gdl, h: thickness.gdl },
  { type: 'Gasket', color: color.gasket, h: thickness.gasket },
  { type: 'Graphite Plate', color: color.graphite, h: thickness.graphite },
  { type: 'Current Collector', color: color.collector, h: thickness.collector },
  { type: 'Frame / End Plate', color: color.frame, h: thickness.frame }
];

// Build layers stacked vertically
const stackObjects = [];
layers.forEach(layer => {
  currentY += layer.h / 2;
  let obj;

  if (layer.type === 'Gasket') obj = createGasket(width, layer.h, depth, layer.color, currentY, layer.type);
  else if (layer.type === 'Graphite Plate') obj = createGraphitePlate(width, layer.h, depth, layer.color, currentY, layer.type);
  else if (layer.type === 'Catalyst-Coated Membrane') obj = createMembrane(width, layer.h, depth, currentY, layer.type);
  else if (layer.type === 'Frame / End Plate') obj = createFrame(width, layer.h, depth, layer.color, currentY, layer.type);
  // else if (layer.type === 'Gas Diffusion Layer') {
  //   const baseY = currentY; 

  //   loadGDLModel(currentY, layer.type, (loadedObj) => {
  //     stackObjects.push({
  //       object: loadedObj,
  //       baseY: baseY,
  //       label: createLabel(layer.type, new THREE.Vector3(width * 0.8, baseY, 0))
  //     });
  //   });

  //   currentY += layer.h / 2;
  //   return;
  // }
  else if (layer.type === 'Gas Diffusion Layer') {
    const baseY = currentY; 

    loadGDLModel(currentY, layer.type, (loadedObj) => {
      stackObjects.push({
        object: loadedObj,
        baseY: baseY,
        label: createLabel(layer.type, new THREE.Vector3(width * 0.8, baseY, 0))
      });
    });

    currentY += layer.h / 2;
    return;
  }
  else obj = createLayer(width, layer.h, depth, layer.color, currentY, layer.type);

  
  stackObjects.push({
    object: obj,
    baseY: currentY,
    label: createLabel(layer.type, new THREE.Vector3(width * 0.8, currentY, 0))
  });
  currentY += layer.h / 2;
});



// Add connector pipes (gas inlet/outlet)
const pipeGeometry = new THREE.CylinderGeometry(0.15, 0.15, currentY, 16);
const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0xdddd00 });
const pipe1 = new THREE.Mesh(pipeGeometry, pipeMaterial);
pipe1.position.set(1.2, currentY / 2, 1.2);
scene.add(pipe1);

const pipe2 = new THREE.Mesh(pipeGeometry, pipeMaterial);
pipe2.position.set(-1.2, currentY / 2, -1.2);
scene.add(pipe2);

let exploded = false;
const explodeDistance = 0.5;

document.getElementById("expandBtn").addEventListener('click', () => {
  exploded = !exploded;
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  stackObjects.forEach((item, index) => {
    const targetY = exploded
      ? item.baseY + index * explodeDistance
      : item.baseY;

    item.object.position.y += (targetY - item.object.position.y) * 0.15;

    // Show labels only when expanded
    item.label.visible = exploded;
    item.label.position.y = item.object.position.y; // sync label position
  });

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});



const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
  // convert mouse position to normalized device coords
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(
    stackObjects.map(o => o.object),
    true
  );

  if (intersects.length > 0) {
    const clicked = intersects[0].object;
    showLayerPopup(clicked.name);
  }
});

const popup = document.getElementById('layerPopup');
const popupBody = document.getElementById('popupBody');
const closePopup = document.getElementById('closePopup');

closePopup.addEventListener('click', () => popup.style.display = 'none');

function showLayerPopup(layerName) {
  popup.style.display = 'flex';

  let content = '';

  if (layerName === 'Graphite Plate') {
    content = `
      <h2>Graphite Plate</h2>

      <h3 style = "margin-top: 12px; margin-bottom: 5px>What It Is / How It Looks</h3>
      <p>
        A solid, dark grey or black plate made from compressed graphite.  
        It looks smooth, slightly shiny, and feels light compared to metal.  
        It often has carved or molded grooves on one side to guide gases through the cell.
      </p>

      <h3 style = "margin-top: 12px; margin-bottom: 5px>What It Does</h3>
      <p>
        It helps move gases (hydrogen and oxygen/air) across the fuel cell,  
        collects electrons, and spreads heat evenly.  
        Think of it as a strong, conductive “backbone” that makes sure everything flows and stays stable.
      </p>

      <h3 style = "margin-top: 12px; margin-bottom: 5px>How It’s Made</h3>
      <p>
        Graphite powder is mixed with binders, pressed into shape, and then baked at high 
        temperatures to make it strong and conductive.  
        Channels or patterns are either machined or molded into the surface.
      </p>

      <h3 style = "margin-top: 12px; margin-bottom: 5px>Extra Notes</h3>
      <p>
        Graphite plates are popular because they don’t rust, they handle heat well,  
        and they conduct electricity nicely.  
        Downsides: they can be fragile and more expensive than stamped metal plates.
      </p>
    `;
  } 

  else if (layerName === 'Current Collector') {
    content = `
      <h2>Current Collector</h2>

      <h3 style = "margin-top: 12px; margin-bottom: 5px">What It Is / How It Looks</h3>
      <p>
        A thin, rigid plate placed at the outer sides of the fuel cell stack.  
        It usually appears as a flat metal or carbon-based sheet with smooth surfaces,  
        sometimes with tabs or contact points for electrical connections.
      </p>

      <h3 style = "margin-top: 12px; margin-bottom: 5px">What It Does</h3>
      <p>
        It gathers the electrons produced inside the cell and delivers them to the 
        external circuit. Its main purpose is to keep electrical resistance low so 
        power isn’t wasted as heat.
      </p>

      <h3 style = "margin-top: 12px; margin-bottom: 5px">How It’s Made</h3>
      <p>
        <strong>Proton-Exchange Membrane Fuel Cells:</strong> Often stainless steel, nickel-coated steel, or graphite plates.  
        These are typically stamped or machined into shape.<br><br>
        <strong>Solid Oxide Fuel Cell:</strong> Commonly ferritic steel plates or metal meshes.  
        Sometimes coated with nickel or gold to resist corrosion and improve conductivity.
      </p>

      <h3 style = "margin-top: 12px; margin-bottom: 5px">Extra Notes</h3>
      <p>
        A good current collector spreads current evenly, avoids corrosion, and prevents hot spots.  
        Poor collectors cause big efficiency losses.
      </p>
    `;
  }
  
  else if (layerName === 'Catalyst-Coated Membrane') {
    content = `
      <h2>Catalyst-Coated Membrane (CCM)</h2>

      <h3 style = "margin-top: 12px; margin-bottom: 5px">What It Is / How It Looks</h3>
      <p>
        A very thin, flexible sheet that sits in the center of the fuel cell.  
        It looks like a soft plastic film, usually slightly opaque or off-white.  
        Both sides of this film are coated with a dark, powdery-looking layer — that’s the catalyst.
      </p>

      <h3 style = "margin-top: 12px; margin-bottom: 5px">What It Does</h3>
      <p>
        This is where the actual chemical reaction happens.  
        The membrane lets protons pass through but blocks electrons.  
        The catalyst on each side helps split hydrogen and combine oxygen.  
        In short: this layer is the “heart” of the fuel cell, creating electricity.
      </p>

      <h3 style = "margin-top: 12px; margin-bottom: 5px">How It’s Made</h3>
      <p>
        A proton-conducting membrane (often Nafion) is used as the base.  
        Platinum or platinum-alloy particles are mixed into ink and sprayed, rolled, or printed  
        onto both sides of the membrane.  
        After that, it’s dried and pressed to make sure the catalyst sticks evenly.
      </p>

      <h3 style = "margin-top: 12px; margin-bottom: 5px">Extra Notes</h3>
      <p>
        The CCM controls efficiency and durability.  
        More uniform catalyst layers mean better performance, but platinum is expensive,  
        so manufacturers try to use the least amount while keeping power high.
      </p>
    `;
  }
  
  else {
    content = `<h2>${layerName}</h2><p>Information coming soon.</p>`;
  }

  popupBody.innerHTML = content;
}

