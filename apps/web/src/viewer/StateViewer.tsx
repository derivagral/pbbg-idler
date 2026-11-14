import { useEffect, useRef, useState } from "react";
import type { Character, Skill } from "@idler/contracts";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Rendering/edgesRenderer";

interface ViewState {
  scene: Scene;
  player: TransformNode;
  rat: TransformNode;
  playerHealth: Mesh;
  ratHealth: Mesh;
  markers: Record<Skill, Mesh>;
}

const LOCATIONS: Record<Skill, [number, number]> = {
  woodcutting: [-2.8, 1.6],
  mining: [2.5, 1.7],
  fishing: [2.7, -1.9],
  foraging: [-2.6, -1.8],
};

/** Renders the latest server snapshot. The scene never advances game state. */
export default function StateViewer({ character }: { character: Character }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<ViewState | null>(null);
  const snapshotRef = useRef(character);
  const [unavailable, setUnavailable] = useState(false);
  const [ready, setReady] = useState(false);
  snapshotRef.current = character;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: Engine | undefined;
    let scene: Scene | undefined;
    let observer: ResizeObserver | undefined;
    let disposed = false;
    const fail = () => {
      if (!disposed) {
        setUnavailable(true);
        setReady(false);
      }
      engine?.stopRenderLoop();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      fail();
    };
    canvas.addEventListener("webglcontextlost", contextLost);

    try {
      if (!Engine.isSupported()) throw new Error("WebGL unavailable");
      engine = new Engine(
        canvas,
        true,
        { preserveDrawingBuffer: true, stencil: true },
        true,
      );
      engine.setHardwareScalingLevel(
        Math.max(1, (window.devicePixelRatio || 1) / 1.5),
      );
      scene = new Scene(engine);
      scene.clearColor = new Color4(0.045, 0.082, 0.072, 1);
      scene.ambientColor = new Color3(0.4, 0.46, 0.38);
      const camera = new ArcRotateCamera(
        "field-camera",
        -Math.PI / 2.4,
        0.82,
        15.7,
        new Vector3(0, 0, 0),
        scene,
      );
      camera.attachControl(canvas, true);
      camera.lowerRadiusLimit = 10;
      camera.upperRadiusLimit = 21;
      camera.lowerBetaLimit = 0.3;
      camera.upperBetaLimit = 1.3;
      camera.wheelPrecision = 40;
      camera.panningSensibility = 0;
      // Reduced motion disables camera inertia; the diorama never auto-orbits.
      camera.inertia = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? 0
        : 0.7;
      const sky = new HemisphericLight(
        "soft-sky",
        new Vector3(0.2, 1, 0.1),
        scene,
      );
      sky.intensity = 1.5;
      sky.groundColor = new Color3(0.18, 0.22, 0.18);
      const sun = new DirectionalLight(
        "late-sun",
        new Vector3(-1, -2, 1),
        scene,
      );
      sun.intensity = 0.7;

      const material = (name: string, color: string, glow = false) => {
        const value = new StandardMaterial(name, scene);
        value.diffuseColor = Color3.FromHexString(color);
        value.specularColor = new Color3(0.05, 0.05, 0.05);
        if (glow) value.emissiveColor = Color3.FromHexString(color).scale(0.5);
        return value;
      };
      const earth = material("earth", "#3a4934");
      const meadow = material("meadow", "#6a8050");
      const bark = material("bark", "#69533b");
      const pine = material("pine", "#304b39");
      const foliage = material("leaves", "#557447");
      const rock = material("stone", "#818881");
      const copper = material("copper", "#c79a67");
      const water = material("water", "#527e80");
      const path = material("path", "#9e9270");
      const green = material("herbs", "#9dbd6f");
      const gold = material("selection", "#e6c37a", true);
      const white = material("traveller-coat", "#efe0b7");
      const dark = material("traveller-boots", "#3b3730");
      const red = material("rat", "#926f5c");
      const health = material("health", "#b5d281", true);
      const enemyHealth = material("enemy-health", "#dd916c", true);
      const box = (
        name: string,
        width: number,
        height: number,
        depth: number,
        x: number,
        y: number,
        z: number,
        mat: StandardMaterial,
      ) => {
        const mesh = MeshBuilder.CreateBox(
          name,
          { width, height, depth },
          scene,
        );
        mesh.position.set(x, y, z);
        mesh.material = mat;
        return mesh;
      };
      box("one-map-tile-base", 10.5, 0.75, 8.5, 0, -0.48, 0, earth);
      box("one-map-tile-grass", 10.5, 0.12, 8.5, 0, -0.04, 0, meadow);
      box("west-east-path", 8.6, 0.025, 0.7, -0.4, 0.04, 0, path);
      box("north-south-path", 0.65, 0.027, 6.1, 0, 0.045, 0, path);
      box("stream", 1.05, 0.035, 7.9, 3.7, 0.05, 0, water);
      box("stream-bank", 0.22, 0.045, 7.9, 3.04, 0.04, 0, path);
      box("wood-bridge", 2.0, 0.13, 0.8, 3.65, 0.14, 0.1, bark);

      const tree = (x: number, z: number, scale: number) => {
        const trunk = MeshBuilder.CreateCylinder(
          "tree-trunk",
          { height: 1.0 * scale, diameter: 0.21 * scale, tessellation: 6 },
          scene,
        );
        trunk.position.set(x, 0.5 * scale, z);
        trunk.material = bark;
        const crown = MeshBuilder.CreateCylinder(
          "tree-crown",
          {
            height: 1.8 * scale,
            diameterTop: 0,
            diameterBottom: 1.45 * scale,
            tessellation: 6,
          },
          scene,
        );
        crown.position.set(x, 1.6 * scale, z);
        crown.material = pine;
        const upper = MeshBuilder.CreateCylinder(
          "tree-upper-crown",
          {
            height: 1.2 * scale,
            diameterTop: 0,
            diameterBottom: 1.0 * scale,
            tessellation: 6,
          },
          scene,
        );
        upper.position.set(x, 2.3 * scale, z);
        upper.material = foliage;
      };
      [
        [-4.3, 2.8, 1],
        [-3.2, 3.1, 0.85],
        [-4.4, 1.3, 0.8],
        [-2.1, 3.1, 1.1],
        [-4.5, -3.1, 0.6],
        [0.9, 3.3, 0.7],
      ].forEach(([x, z, s]) => tree(x, z, s));
      [
        [2.4, 2.5, 0.7],
        [1.7, 2.7, 0.5],
        [2.8, 3.1, 0.9],
      ].forEach(([x, z, size]) => {
        const stone = MeshBuilder.CreateSphere(
          "ore-outcrop",
          { diameter: size * 1.8, segments: 2 },
          scene,
        );
        stone.position.set(x, size * 0.5, z);
        stone.scaling.set(1, 0.75, 0.8);
        stone.material = rock;
        box(
          "copper-vein",
          0.18,
          0.12,
          size,
          x,
          size * 1.05,
          z,
          copper,
        ).rotation.y = 0.5;
      });
      for (let index = 0; index < 8; index++) {
        const angle = index * 2.4;
        const herb = MeshBuilder.CreateCylinder(
          "meadow-herb",
          {
            height: 0.38,
            diameterTop: 0.03,
            diameterBottom: 0.21,
            tessellation: 5,
          },
          scene,
        );
        herb.position.set(
          -3.0 + Math.cos(angle) * 0.75,
          0.2,
          -2.4 + Math.sin(angle) * 0.65,
        );
        herb.rotation.z = Math.cos(angle) * 0.3;
        herb.material = green;
      }
      const rod = box("fishing-rod", 0.06, 1.8, 0.06, 3.0, 0.8, -2.4, bark);
      rod.rotation.z = -0.5;
      box("fishing-stool", 0.45, 0.35, 0.45, 2.6, 0.2, -2.6, bark);
      box("resting-stone", 0.9, 0.35, 0.8, -0.6, 0.2, -0.8, rock);

      const markers = {} as Record<Skill, Mesh>;
      for (const [skill, [x, z]] of Object.entries(LOCATIONS) as [
        Skill,
        [number, number],
      ][]) {
        const ring = MeshBuilder.CreateTorus(
          `${skill}-active-marker`,
          { diameter: 1.1, thickness: 0.045, tessellation: 36 },
          scene,
        );
        ring.position.set(x, 0.11, z);
        ring.material = gold;
        ring.setEnabled(false);
        markers[skill] = ring;
      }
      const player = new TransformNode("traveller", scene);
      const coat = box("traveller-body", 0.38, 0.6, 0.28, 0, 0.65, 0, white);
      coat.parent = player;
      const head = MeshBuilder.CreateSphere(
        "traveller-head",
        { diameter: 0.28, segments: 5 },
        scene,
      );
      head.position.set(0, 1.09, 0);
      head.material = copper;
      head.parent = player;
      for (const x of [-0.12, 0.12]) {
        const boot = box("traveller-boot", 0.13, 0.3, 0.2, x, 0.2, 0, dark);
        boot.parent = player;
      }
      const playerHealth = box(
        "traveller-health",
        0.9,
        0.07,
        0.08,
        0,
        1.45,
        0,
        health,
      );
      playerHealth.parent = player;

      const rat = new TransformNode("bramble-rat", scene);
      rat.position.set(1.15, 0, -0.4);
      const ratBody = MeshBuilder.CreateSphere(
        "rat-body",
        { diameter: 0.6, segments: 5 },
        scene,
      );
      ratBody.scaling.set(1.3, 0.65, 0.8);
      ratBody.position.set(0, 0.27, 0);
      ratBody.material = red;
      ratBody.parent = rat;
      for (const z of [-0.14, 0.14]) {
        const ear = MeshBuilder.CreateSphere(
          "rat-ear",
          { diameter: 0.19, segments: 4 },
          scene,
        );
        ear.position.set(-0.22, 0.5, z);
        ear.material = copper;
        ear.parent = rat;
      }
      const tail = box("rat-tail", 0.5, 0.045, 0.045, 0.55, 0.18, 0, red);
      tail.rotation.y = -0.4;
      tail.parent = rat;
      const ratHealth = box(
        "rat-health",
        0.8,
        0.06,
        0.07,
        0,
        0.85,
        0,
        enemyHealth,
      );
      ratHealth.parent = rat;
      viewRef.current = {
        scene,
        player,
        rat,
        playerHealth,
        ratHealth,
        markers,
      };
      paintSnapshot(viewRef.current, snapshotRef.current);
      const activeEngine = engine;
      const activeScene = scene;
      activeEngine.runRenderLoop(() => {
        try {
          activeScene.render();
        } catch {
          fail();
        }
      });
      observer = new ResizeObserver(() => activeEngine.resize());
      observer.observe(canvas);
      activeEngine.resize();
      setReady(true);
    } catch {
      fail();
      scene?.dispose();
      engine?.dispose();
      engine = undefined;
      scene = undefined;
    }
    return () => {
      disposed = true;
      observer?.disconnect();
      canvas.removeEventListener("webglcontextlost", contextLost);
      engine?.stopRenderLoop();
      scene?.dispose();
      engine?.dispose();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (viewRef.current) paintSnapshot(viewRef.current, character);
  }, [character]);

  if (unavailable)
    return (
      <div
        role="status"
        data-testid="viewer-unavailable"
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "#cabd9c",
          border: "1px solid #3b4b3b",
          borderRadius: 12,
        }}
      >
        The 3D view is unavailable in this browser. Your journey continues in
        the map above.
      </div>
    );

  return (
    <figure style={{ margin: 0 }} data-testid="state-viewer" data-ready={ready}>
      <canvas
        ref={canvasRef}
        aria-label="Hearthwild 3D state viewer"
        tabIndex={0}
        style={{
          display: "block",
          width: "100%",
          height: "clamp(260px, 40vw, 420px)",
          borderRadius: 12,
          touchAction: "none",
          outlineOffset: 4,
        }}
      />
      <figcaption
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          padding: "10px 2px 0",
          color: "#a8b29e",
          fontSize: 12,
        }}
      >
        <span>
          {ready ? "Live view · The Hearthwild" : "Opening the field view…"}
        </span>
        <span>Drag to orbit · Scroll to zoom · Read-only view</span>
      </figcaption>
    </figure>
  );
}

function paintSnapshot(view: ViewState, character: Character) {
  const { activity } = character;
  for (const [skill, marker] of Object.entries(view.markers)) {
    marker.setEnabled(activity.kind === "gather" && activity.skill === skill);
  }
  const position =
    activity.kind === "gather"
      ? LOCATIONS[activity.skill]
      : activity.kind === "combat"
        ? [-0.25, -0.4]
        : [-0.6, -1.4];
  view.player.position.set(position[0], 0.07, position[1]);
  view.playerHealth.scaling.x = Math.max(
    0,
    Math.min(1, character.hp / character.maxHp),
  );
  view.rat.setEnabled(
    activity.kind === "combat" && character.combat.enemyHp > 0,
  );
  view.ratHealth.scaling.x = Math.max(
    0,
    Math.min(1, character.combat.enemyHp / character.combat.enemyMaxHp),
  );
}
