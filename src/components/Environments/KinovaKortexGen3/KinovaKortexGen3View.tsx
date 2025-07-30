import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import URDFLoader, { URDFJoint, URDFRobot } from 'urdf-loader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Props {
    onRobotLoad: (robot: URDFRobot, initialJoints: Record<string, number>) => void;
    jointValues: Record<string, number>;
}

const KinovaKortexGen3View = ({ onRobotLoad, jointValues }: Props) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const robotRef = useRef<URDFRobot | null>(null);

    useEffect(() => {
        if (!robotRef.current) return;
        for (const [name, value] of Object.entries(jointValues)) {
            if (robotRef.current.joints[name]) {
                robotRef.current.setJointValue(name, value);
            }
        }
    }, [jointValues]);

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
                robotRef.current = robot;

                const initialJointValues: Record<string, number> = {};
                Object.values(robot.joints).forEach((j: URDFJoint) => {
                    initialJointValues[j.name] = j.angle;
                });
                onRobotLoad(robot, initialJointValues);
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
        };
    }, [onRobotLoad]);

    return (
        <div className="w-full h-full relative">
            <div ref={mountRef} className="w-full h-full" />
        </div>
    );
};

export default KinovaKortexGen3View;
