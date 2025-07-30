import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import URDFLoader, { URDFJoint, URDFRobot } from 'urdf-loader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const KinovaKortexGen3View = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const [robot, setRobot] = useState<URDFRobot | null>(null);
    const [jointValues, setJointValues] = useState<Record<string, number>>({});

    const handleJointChange = (jointName: string, value: number) => {
        if (!robot || isNaN(value)) return;

        robot.setJointValue(jointName, value);
        setJointValues(prev => ({...prev, [jointName]: value}));
    };

    useEffect(() => {
        const currentMount = mountRef.current;
        if (!currentMount) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x263238);

        const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
        camera.position.set(1.5, 1.2, 1.5);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        renderer.shadowMap.enabled = true;
        currentMount.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = 0.5;
        controls.maxDistance = 5;
        controls.target.set(0, 0.4, 0);
        controls.update();

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(2, 5, 3);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        // Ground plane
        // const plane = new THREE.Mesh(
        //     new THREE.PlaneGeometry(5, 5),
        //     new THREE.MeshStandardMaterial({ color: 0xcccccc })
        // );
        // plane.rotation.x = -Math.PI / 2;
        // plane.receiveShadow = true;
        // scene.add(plane);

        // URDF Loader
        const loader = new URDFLoader();
        loader.packages = {
            'kortex_description': '/models/kinova_kortex_gen3_6dof/kortex_description'
        };

        loader.load(
            '/models/kinova_kortex_gen3_6dof/kortex_description/arms/gen3/6dof/urdf/GEN3-6DOF_VISION_URDF_ARM_V01.urdf',
            (robot: URDFRobot) => {
                console.log(robot);
                robot.rotation.x = -Math.PI / 2;
                robot.traverse(c => {
                    c.castShadow = true;
                });
                scene.add(robot);
                setRobot(robot);

                const initialJointValues: Record<string, number> = {};
                Object.values(robot.joints).forEach((j: URDFJoint) => {
                    initialJointValues[j.name] = j.angle;
                });
                setJointValues(initialJointValues);
            },
            undefined,
            (error) => {
                console.error("Error loading URDF:", error);
            }
        );

        // Animation loop
        let animationFrameId: number;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Handle window resize
        const handleResize = () => {
            if (!currentMount) return;
            camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
            if (currentMount) {
              currentMount.removeChild(renderer.domElement);
            }
            // It's good practice to dispose of Three.js objects, but it can be complex.
            // For this scope, removing the renderer from DOM is sufficient.
        };
    }, []);

    return (
        <div className="w-full h-full relative">
            <div ref={mountRef} className="w-full h-full" />
            {robot && (
                <div className="absolute top-0 right-0 w-80 max-h-full overflow-y-auto p-4 bg-gray-900/80 text-white rounded-bl-lg">
                    <h3 className="text-lg font-bold mb-2">Joints</h3>
                    <ul className="space-y-2">
                        {Object.values(robot.joints)
                            .filter((joint: URDFJoint) => joint.jointType !== 'fixed')
                            .map((joint: URDFJoint) => {
                                const min = joint.jointType === 'continuous' ? -2 * Math.PI : joint.limit.lower;
                                const max = joint.jointType === 'continuous' ? 2 * Math.PI : joint.limit.upper;
                                const value = jointValues[joint.name] || 0;
                                return (
                                    <li key={joint.name}>
                                        <label className="block text-sm font-medium truncate" title={joint.name}>{joint.name}</label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="range"
                                                min={min}
                                                max={max}
                                                step="0.001"
                                                value={value}
                                                onChange={e => handleJointChange(joint.name, parseFloat(e.target.value))}
                                                className="w-full"
                                            />
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={ (value * (180 / Math.PI)).toFixed(1) }
                                                onChange={e => handleJointChange(joint.name, parseFloat(e.target.value) * (Math.PI / 180))}
                                                className="w-20 bg-gray-700 text-white p-1 rounded"
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default KinovaKortexGen3View;
