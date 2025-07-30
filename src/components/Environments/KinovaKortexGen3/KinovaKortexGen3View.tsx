import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const KinovaKortexGen3View = () => {
    const mountRef = useRef<HTMLDivElement>(null);

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
            '/models/kinova_kortex_gen3_6dof/kortex_description/arms/gen3/6dof/urdf/GEN3-6DOF_BRAKES_VISION_URDF_ARM_V01.urdf',
            (robot) => {
                console.log(robot);
                robot.rotation.x = -Math.PI / 2;
                robot.traverse(c => {
                    c.castShadow = true;
                });
                scene.add(robot);
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

    return <div ref={mountRef} className="w-full h-full" />;
};

export default KinovaKortexGen3View;
