import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';

// Individual Skill Node
function SkillNode({ position, color, label, isMissing }) {
  const meshRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    meshRef.current.position.y = position[1] + Math.sin(t + position[0]) * 0.2;
    if (isMissing) {
      meshRef.current.material.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.5; // Pulsing effect
    }
  });

  return (
    <group position={position}>
      <Sphere ref={meshRef} args={[0.15, 32, 32]}>
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={isMissing ? 0.8 : 0.4} 
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>
      <Html distanceFactor={5} center>
        <div className={`px-2 py-1 rounded text-xs font-semibold backdrop-blur-md border ${
          isMissing ? 'bg-orange-500/20 border-orange-500/50 text-orange-200' : 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
        }`}>
          {label}
        </div>
      </Html>
    </group>
  );
}

// Main 3D Canvas
export default function SkillGalaxy({ strengths = [], missingSkills = [] }) {
  // Generate random positions in a spherical distribution
  const nodes = useMemo(() => {
    const allSkills = [
      ...strengths.map(s => ({ label: s, missing: false, color: '#6366f1' })),
      ...missingSkills.map(s => ({ label: s, missing: true, color: '#f97316' }))
    ];

    return allSkills.map((skill, i) => {
      const phi = Math.acos(-1 + (2 * i) / allSkills.length);
      const theta = Math.sqrt(allSkills.length * Math.PI) * phi;
      const radius = 2.5; // Spread
      return {
        ...skill,
        position: [
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.sin(theta) * Math.sin(phi),
          radius * Math.cos(phi)
        ]
      };
    });
  }, [strengths, missingSkills]);

  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden bg-zinc-900/50 border border-zinc-800 relative shadow-2xl shadow-indigo-500/10">
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-sm font-semibold text-zinc-300 tracking-wide uppercase">AI Skill Topography</h3>
        <p className="text-xs text-zinc-500 mt-1">Interactive 3D mapping of your tech stack</p>
      </div>
      <Canvas camera={{ position: [0, 0, 6], fov: 60 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#6366f1" />
        <group>
          {nodes.map((node, i) => (
            <SkillNode key={i} {...node} />
          ))}
        </group>
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}