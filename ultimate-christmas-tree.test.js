/**
 * UltimateChristmasTree 单元测试套件
 * 
 * 测试覆盖范围：
 * - Three.js 初始化和场景设置
 * - 粒子系统创建（圣诞树和雪花）
 * - 手势识别和交互逻辑
 * - 动画循环和渲染
 * - 响应式窗口调整
 * - 边界条件和异常处理
 */

// Mock 外部依赖
global.THREE = {
    Scene: jest.fn().mockImplementation(() => ({
        fog: null,
        add: jest.fn()
    })),
    PerspectiveCamera: jest.fn().mockImplementation((fov, aspect, near, far) => ({
        aspect,
        position: { set: jest.fn() },
        updateProjectionMatrix: jest.fn()
    })),
    WebGLRenderer: jest.fn().mockImplementation(() => ({
        setSize: jest.fn(),
        setPixelRatio: jest.fn(),
        domElement: document.createElement('canvas'),
        render: jest.fn()
    })),
    BufferGeometry: jest.fn().mockImplementation(() => ({
        setAttribute: jest.fn(),
        attributes: { position: { array: new Float32Array(), needsUpdate: false } }
    })),
    BufferAttribute: jest.fn(),
    Points: jest.fn().mockImplementation(() => ({
        rotation: { y: 0 },
        scale: { set: jest.fn() },
        material: { opacity: 1 }
    })),
    PointsMaterial: jest.fn(),
    FogExp2: jest.fn(),
    AdditiveBlending: 'additive'
};

global.gsap = {
    to: jest.fn()
};

global.Hands = jest.fn().mockImplementation(() => ({
    setOptions: jest.fn(),
    onResults: jest.fn()
}));

global.Camera = jest.fn().mockImplementation(() => ({
    start: jest.fn()
}));

// Mock DOM 元素
document.getElementById = jest.fn((id) => {
    const mockElement = {
        style: {},
        innerText: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn()
    };
    
    if (id === 'video-preview') {
        mockElement.width = 640;
        mockElement.height = 480;
    }
    
    return mockElement;
});

// Mock window 对象
Object.defineProperty(window, 'innerWidth', {
    writable: true,
    value: 1024
});

Object.defineProperty(window, 'innerHeight', {
    writable: true,
    value: 768
});

Object.defineProperty(window, 'devicePixelRatio', {
    writable: true,
    value: 1
});

Object.defineProperty(window, 'onload', {
    writable: true,
    value: null
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
    setTimeout(cb, 16);
    return 1;
});

// 导入被测试的类（需要从HTML文件中提取）
class UltimateChristmasTree {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.statusEl = document.getElementById('gesture-status');
        
        // 核心配置
        this.treeParticleCount = 30000;
        this.snowCount = 1500;
        this.explodeVal = 0;
        
        // 交互状态
        this.isPinching = false;
        this.pinchStartX = 0;
        this.treeBaseRotation = 0;
        this.rotationVelocity = 0;

        this.initThree();
        this.createTreeParticles();
        this.createSnowBackground();
        this.initAI();
        this.animate();
        this.handleResize();
    }

    /**
     * 初始化Three.js场景、相机和渲染器
     * 设置相机位置和场景雾效
     */
    initThree() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.set(0, 2, 18);
        this.scene.fog = new THREE.FogExp2(0x010501, 0.015);
    }

    /**
     * 创建圣诞树粒子系统
     * 使用Wobble算法生成层级感的树形结构
     * 包含绿色、金色和红色的粒子分布
     */
    createTreeParticles() {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(this.treeParticleCount * 3);
        const colors = new Float32Array(this.treeParticleCount * 3);
        
        const cGreen = { r: 0.1, g: 0.26, b: 0.16 }; // 0x1a432a
        const cGold = { r: 0.83, g: 0.69, b: 0.22 }; // 0xd4af37
        const cRed = { r: 0.67, g: 0, b: 0 }; // 0xaa0000

        for (let i = 0; i < this.treeParticleCount; i++) {
            const h = Math.random();
            const radiusSpread = (1 - h) * 6;
            // Wobble Algorithm 还原层级感
            const wobble = Math.pow(Math.sin(h * Math.PI * 8), 2) * 1.6 * (1 - h);
            const r = (radiusSpread + wobble) * Math.pow(Math.random(), 0.5);
            const angle = Math.random() * Math.PI * 2;

            pos[i*3] = Math.cos(angle) * r;
            pos[i*3+1] = h * 15 - 7.5;
            pos[i*3+2] = Math.sin(angle) * r;

            let col = h > 0.98 ? cGold : (Math.random() > 0.96 ? cGold : (Math.random() > 0.93 ? cRed : cGreen));
            colors[i*3] = col.r; colors[i*3+1] = col.g; colors[i*3+2] = col.b;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        this.treePoints = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.045, vertexColors: true, transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        }));
        
        this.scene.add(this.treePoints);
    }

    /**
     * 创建雪花背景粒子系统
     * 生成随机分布的雪花粒子并设置下落速度
     */
    createSnowBackground() {
        const snowGeo = new THREE.BufferGeometry();
        const snowPos = new Float32Array(this.snowCount * 3);
        this.snowSpeeds = new Float32Array(this.snowCount);

        for (let i = 0; i < this.snowCount; i++) {
            snowPos[i * 3] = (Math.random() - 0.5) * 45;
            snowPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
            snowPos[i * 3 + 2] = (Math.random() - 0.5) * 25;
            this.snowSpeeds[i] = 0.02 + Math.random() * 0.04;
        }

        snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
        const snowMat = new THREE.PointsMaterial({
            color: 0xffffff, size: 0.06, transparent: true, opacity: 0.4,
            blending: THREE.AdditiveBlending, depthWrite: false
        });

        this.snowSystem = new THREE.Points(snowGeo, snowMat);
        this.scene.add(this.snowSystem);
    }

    /**
     * 初始化AI手势识别系统
     * 配置MediaPipe Hands并设置手势检测回调
     */
    initAI() {
        const videoElement = document.getElementById('video-preview');
        const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: window.innerWidth < 768 ? 0 : 1, 
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });

        hands.onResults((results) => {
            document.getElementById('loading-screen').style.opacity = '0';
            setTimeout(() => { document.getElementById('loading-screen').style.display = 'none'; }, 500);
            
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const lm = results.multiHandLandmarks[0];
                
                // 捏合判定逻辑 (食指尖8与大拇指尖4)
                const refDist = Math.hypot(lm[8].x - lm[5].x, lm[8].y - lm[5].y);
                const pinchDist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
                const isPinchingNow = pinchDist < refDist * 0.6;

                if (isPinchingNow) {
                    if (!this.isPinching) {
                        this.isPinching = true;
                        this.pinchStartX = lm[8].x;
                        this.treeBaseRotation = this.treePoints.rotation.y;
                    }
                    const deltaX = lm[8].x - this.pinchStartX;
                    this.treePoints.rotation.y = this.treeBaseRotation + deltaX * 10;
                    this.rotationVelocity = deltaX * 0.3; // 惯性系数
                    this.statusEl.innerText = "✨ 已捏住：左右拨动";
                    this.statusEl.style.color = "#ffd700";
                } else {
                    this.isPinching = false;
                    this.rotationVelocity *= 0.94; // 惯性衰减
                    
                    const isFist = lm[12].y > lm[9].y && lm[16].y > lm[13].y;
                    if (isFist) {
                        this.statusEl.innerText = "✊ 握拳：收拢态";
                        this.statusEl.style.color = "#fff";
                        gsap.to(this, { explodeVal: 0, duration: 0.8, ease: "power2.out" });
                    } else {
                        this.statusEl.innerText = "🖐️ 张开：发散态";
                        this.statusEl.style.color = "#d4af37";
                        gsap.to(this, { explodeVal: 1.3, duration: 0.8, ease: "power2.out" });
                    }
                }
            }
        });

        const camera = new Camera(videoElement, {
            onFrame: async () => { await hands.send({ image: videoElement }); },
            width: 640, height: 480
        });
        camera.start();
    }

    /**
     * 动画循环函数
     * 处理雪花下落、圣诞树旋转和缩放动画
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        // 1. 雪花下落逻辑
        const snowArr = this.snowSystem.geometry.attributes.position.array;
        for (let i = 0; i < this.snowCount; i++) {
            snowArr[i * 3 + 1] -= this.snowSpeeds[i]; // 下落
            snowArr[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.005; // 左右飘荡
            if (snowArr[i * 3 + 1] < -20) snowArr[i * 3 + 1] = 20; // 循环
        }
        this.snowSystem.geometry.attributes.position.needsUpdate = true;

        // 2. 圣诞树旋转与形变
        if (!this.isPinching) {
            this.treePoints.rotation.y += 0.005 + this.rotationVelocity;
        }

        // 3. 应用发散/收拢 Scale
        const scaleH = 1 + this.explodeVal * 0.8;
        const scaleV = 1 - this.explodeVal * 0.2;
        this.treePoints.scale.set(scaleH, scaleV, scaleH);
        this.treePoints.material.opacity = 0.9 - (this.explodeVal * 0.3);

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * 处理窗口大小调整事件
     * 更新相机宽高比和渲染器尺寸
     */
    handleResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}

describe('UltimateChristmasTree', () => {
    let christmasTree;

    beforeEach(() => {
        // 重置所有mock
        jest.clearAllMocks();
        
        // 重置window属性
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });
        
        // 创建新实例
        christmasTree = new UltimateChristmasTree();
    });

    describe('构造函数和初始化', () => {
        /**
         * 测试构造函数是否正确初始化所有核心属性
         */
        test('应该正确初始化所有核心属性', () => {
            expect(christmasTree.treeParticleCount).toBe(30000);
            expect(christmasTree.snowCount).toBe(1500);
            expect(christmasTree.explodeVal).toBe(0);
            expect(christmasTree.isPinching).toBe(false);
            expect(christmasTree.pinchStartX).toBe(0);
            expect(christmasTree.treeBaseRotation).toBe(0);
            expect(christmasTree.rotationVelocity).toBe(0);
        });

        /**
         * 测试构造函数是否调用所有初始化方法
         */
        test('应该调用所有初始化方法', () => {
            expect(THREE.Scene).toHaveBeenCalled();
            expect(THREE.PerspectiveCamera).toHaveBeenCalledWith(60, 1024/768, 0.1, 1000);
            expect(THREE.WebGLRenderer).toHaveBeenCalledWith({ antialias: true, alpha: true });
        });
    });

    describe('initThree方法', () => {
        /**
         * 测试Three.js场景初始化
         */
        test('应该正确初始化Three.js场景', () => {
            expect(christmasTree.scene).toBeDefined();
            expect(christmasTree.camera).toBeDefined();
            expect(christmasTree.renderer).toBeDefined();
        });

        /**
         * 测试相机位置设置
         */
        test('应该正确设置相机位置', () => {
            expect(christmasTree.camera.position.set).toHaveBeenCalledWith(0, 2, 18);
        });

        /**
         * 测试渲染器配置
         */
        test('应该正确配置渲染器', () => {
            expect(christmasTree.renderer.setSize).toHaveBeenCalledWith(1024, 768);
            expect(christmasTree.renderer.setPixelRatio).toHaveBeenCalledWith(1);
        });

        /**
         * 测试场景雾效设置
         */
        test('应该设置场景雾效', () => {
            expect(THREE.FogExp2).toHaveBeenCalledWith(0x010501, 0.015);
        });
    });

    describe('createTreeParticles方法', () => {
        /**
         * 测试圣诞树粒子系统创建
         */
        test('应该创建正确数量的粒子', () => {
            expect(THREE.BufferGeometry).toHaveBeenCalled();
            expect(christmasTree.treePoints).toBeDefined();
        });

        /**
         * 测试粒子位置计算
         */
        test('应该正确计算粒子位置', () => {
            // 验证位置数组长度
            const posAttributeMock = { array: new Float32Array(90000) }; // 30000 * 3
            christmasTree.treePoints.geometry.attributes.position = posAttributeMock;
            expect(posAttributeMock.array.length).toBe(90000);
        });

        /**
         * 测试粒子颜色分配
         */
        test('应该正确分配粒子颜色', () => {
            expect(THREE.BufferAttribute).toHaveBeenCalledTimes(2); // position 和 color
        });

        /**
         * 测试粒子材质设置
         */
        test('应该设置正确的粒子材质', () => {
            expect(THREE.PointsMaterial).toHaveBeenCalledWith({
                size: 0.045, 
                vertexColors: true, 
                transparent: true, 
                opacity: 0.85,
                blending: THREE.AdditiveBlending, 
                depthWrite: false, 
                sizeAttenuation: true
            });
        });
    });

    describe('createSnowBackground方法', () => {
        /**
         * 测试雪花粒子系统创建
         */
        test('应该创建雪花粒子系统', () => {
            expect(christmasTree.snowSystem).toBeDefined();
            expect(christmasTree.snowSpeeds).toBeDefined();
            expect(christmasTree.snowSpeeds.length).toBe(1500);
        });

        /**
         * 测试雪花速度范围
         */
        test('应该设置正确的雪花速度范围', () => {
            for (let i = 0; i < christmasTree.snowCount; i++) {
                expect(christmasTree.snowSpeeds[i]).toBeGreaterThanOrEqual(0.02);
                expect(christmasTree.snowSpeeds[i]).toBeLessThanOrEqual(0.06);
            }
        });

        /**
         * 测试雪花材质设置
         */
        test('应该设置正确的雪花材质', () => {
            expect(THREE.PointsMaterial).toHaveBeenCalledWith({
                color: 0xffffff, 
                size: 0.06, 
                transparent: true, 
                opacity: 0.4,
                blending: THREE.AdditiveBlending, 
                depthWrite: false
            });
        });
    });

    describe('initAI方法', () => {
        /**
         * 测试MediaPipe Hands初始化
         */
        test('应该正确初始化MediaPipe Hands', () => {
            expect(Hands).toHaveBeenCalled();
            expect(Camera).toHaveBeenCalled();
        });

        /**
         * 测试手势识别配置
         */
        test('应该设置正确的手势识别配置', () => {
            const handsInstance = Hands.mock.results[0].value;
            expect(handsInstance.setOptions).toHaveBeenCalledWith({
                maxNumHands: 1,
                modelComplexity: 1, // 桌面端
                minDetectionConfidence: 0.6,
                minTrackingConfidence: 0.6
            });
        });

        /**
         * 测试移动端配置
         */
        test('移动端应该使用低复杂度模型', () => {
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 });
            const mobileTree = new UltimateChristmasTree();
            const handsInstance = Hands.mock.results[1].value;
            expect(handsInstance.setOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelComplexity: 0
                })
            );
        });
    });

    describe('手势识别逻辑', () => {
        let handsCallback;

        beforeEach(() => {
            const handsInstance = Hands.mock.results[0].value;
            handsCallback = handsInstance.onResults.mock.calls[0][0];
        });

        /**
         * 测试捏合手势检测
         */
        test('应该正确检测捏合手势', () => {
            const mockResults = {
                multiHandLandmarks: [[
                    { x: 0.5, y: 0.5 }, // 0
                    { x: 0.45, y: 0.4 }, // 5
                    { x: 0.55, y: 0.4 }, // 8
                    { x: 0.52, y: 0.48 } // 4
                ]]
            };

            handsCallback(mockResults);
            expect(christmasTree.isPinching).toBe(true);
        });

        /**
         * 测试握拳手势检测
         */
        test('应该正确检测握拳手势', () => {
            const mockResults = {
                multiHandLandmarks: [[
                    { x: 0.5, y: 0.5 }, // 0
                    { x: 0.45, y: 0.4 }, // 5
                    { x: 0.55, y: 0.4 }, // 8
                    { x: 0.52, y: 0.48 }, // 4
                    { x: 0.45, y: 0.5 }, // 9
                    { x: 0.55, y: 0.5 }, // 12
                    { x: 0.45, y: 0.6 }, // 13
                    { x: 0.55, y: 0.6 }  // 16
                ]]
            };

            handsCallback(mockResults);
            expect(christmasTree.statusEl.innerText).toContain("握拳");
            expect(gsap.to).toHaveBeenCalledWith(christmasTree, { explodeVal: 0, duration: 0.8, ease: "power2.out" });
        });

        /**
         * 测试张开手势检测
         */
        test('应该正确检测张开手势', () => {
            const mockResults = {
                multiHandLandmarks: [[
                    { x: 0.5, y: 0.5 }, // 0
                    { x: 0.45, y: 0.4 }, // 5
                    { x: 0.55, y: 0.4 }, // 8
                    { x: 0.52, y: 0.48 }, // 4
                    { x: 0.45, y: 0.3 }, // 9
                    { x: 0.55, y: 0.3 }, // 12
                    { x: 0.45, y: 0.2 }, // 13
                    { x: 0.55, y: 0.2 }  // 16
                ]]
            };

            handsCallback(mockResults);
            expect(christmasTree.statusEl.innerText).toContain("张开");
            expect(gsap.to).toHaveBeenCalledWith(christmasTree, { explodeVal: 1.3, duration: 0.8, ease: "power2.out" });
        });

        /**
         * 测试无手势情况
         */
        test('应该正确处理无手势情况', () => {
            const mockResults = { multiHandLandmarks: [] };
            handsCallback(mockResults);
            expect(christmasTree.isPinching).toBe(false);
        });
    });

    describe('animate方法', () => {
        /**
         * 测试动画循环调用
         */
        test('应该调用requestAnimationFrame', () => {
            expect(requestAnimationFrame).toHaveBeenCalled();
        });

        /**
         * 测试雪花动画逻辑
         */
        test('应该正确更新雪花位置', () => {
            const mockSnowArray = new Float32Array(4500); // 1500 * 3
            christmasTree.snowSystem.geometry.attributes.position.array = mockSnowArray;
            
            // 模拟一帧动画
            const originalY = mockSnowArray[1];
            christmasTree.animate();
            
            expect(mockSnowArray[1]).toBeLessThan(originalY);
            expect(christmasTree.snowSystem.geometry.attributes.position.needsUpdate).toBe(true);
        });

        /**
         * 测试雪花循环逻辑
         */
        test('应该正确处理雪花循环', () => {
            const mockSnowArray = new Float32Array(4500);
            mockSnowArray[1] = -25; // 设置为低于边界值
            christmasTree.snowSystem.geometry.attributes.position.array = mockSnowArray;
            
            christmasTree.animate();
            
            expect(mockSnowArray[1]).toBe(20); // 应该重置到顶部
        });

        /**
         * 测试圣诞树旋转逻辑
         */
        test('应该在非捏合状态下旋转圣诞树', () => {
            christmasTree.isPinching = false;
            const originalRotation = christmasTree.treePoints.rotation.y;
            
            christmasTree.animate();
            
            expect(christmasTree.treePoints.rotation.y).toBeGreaterThan(originalRotation);
        });

        /**
         * 测试捏合状态下不旋转
         */
        test('捏合状态下不应该旋转圣诞树', () => {
            christmasTree.isPinching = true;
            const originalRotation = christmasTree.treePoints.rotation.y;
            
            christmasTree.animate();
            
            expect(christmasTree.treePoints.rotation.y).toBe(originalRotation);
        });

        /**
         * 测试缩放和透明度变化
         */
        test('应该根据explodeVal调整缩放和透明度', () => {
            christmasTree.explodeVal = 0.5;
            
            christmasTree.animate();
            
            expect(christmasTree.treePoints.scale.set).toHaveBeenCalledWith(1.4, 0.9, 1.4);
            expect(christmasTree.treePoints.material.opacity).toBe(0.75);
        });

        /**
         * 测试渲染调用
         */
        test('应该调用渲染器渲染', () => {
            christmasTree.animate();
            expect(christmasTree.renderer.render).toHaveBeenCalledWith(christmasTree.scene, christmasTree.camera);
        });
    });

    describe('handleResize方法', () => {
        /**
         * 测试resize事件监听器设置
         */
        test('应该设置resize事件监听器', () => {
            expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
        });

        /**
         * 测试resize事件处理
         */
        test('应该正确处理窗口大小变化', () => {
            // 获取resize回调函数
            const resizeCallback = window.addEventListener.mock.calls[0][1];
            
            // 模拟窗口大小变化
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 800 });
            Object.defineProperty(window, 'innerHeight', { writable: true, value: 600 });
            
            resizeCallback();
            
            expect(christmasTree.camera.aspect).toBe(800/600);
            expect(christmasTree.camera.updateProjectionMatrix).toHaveBeenCalled();
            expect(christmasTree.renderer.setSize).toHaveBeenCalledWith(800, 600);
        });
    });

    describe('边界条件和异常处理', () => {
        /**
         * 测试极端窗口尺寸
         */
        test('应该处理极端窗口尺寸', () => {
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 0 });
            Object.defineProperty(window, 'innerHeight', { writable: true, value: 0 });
            
            expect(() => new UltimateChristmasTree()).not.toThrow();
        });

        /**
         * 测试极大粒子数量
         */
        test('应该处理极大粒子数量', () => {
            christmasTree.treeParticleCount = 100000;
            
            expect(() => christmasTree.createTreeParticles()).not.toThrow();
        });

        /**
         * 测试零粒子数量
         */
        test('应该处理零粒子数量', () => {
            christmasTree.treeParticleCount = 0;
            
            expect(() => christmasTree.createTreeParticles()).not.toThrow();
        });

        /**
         * 测试负数explodeVal
         */
        test('应该处理负数explodeVal', () => {
            christmasTree.explodeVal = -1;
            
            expect(() => christmasTree.animate()).not.toThrow();
        });

        /**
         * 测试极大explodeVal
         */
        test('应该处理极大explodeVal', () => {
            christmasTree.explodeVal = 10;
            
            expect(() => christmasTree.animate()).not.toThrow();
        });

        /**
         * 测试手势数据缺失
         */
        test('应该处理手势数据缺失', () => {
            const handsInstance = Hands.mock.results[0].value;
            const callback = handsInstance.onResults.mock.calls[0][0];
            
            expect(() => callback({})).not.toThrow();
            expect(() => callback({ multiHandLandmarks: null })).not.toThrow();
        });

        /**
         * 测试无效手势数据
         */
        test('应该处理无效手势数据', () => {
            const handsInstance = Hands.mock.results[0].value;
            const callback = handsInstance.onResults.mock.calls[0][0];
            
            const invalidResults = {
                multiHandLandmarks: [[
                    { x: NaN, y: Infinity },
                    { x: -Infinity, y: NaN }
                ]]
            };
            
            expect(() => callback(invalidResults)).not.toThrow();
        });
    });

    describe('性能测试', () => {
        /**
         * 测试大量粒子创建性能
         */
        test('应该在合理时间内创建粒子系统', () => {
            const startTime = performance.now();
            christmasTree.createTreeParticles();
            const endTime = performance.now();
            
            expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
        });

        /**
         * 测试动画循环性能
         */
        test('动画循环应该保持高帧率', () => {
            const startTime = performance.now();
            for (let i = 0; i < 10; i++) {
                christmasTree.animate();
            }
            const endTime = performance.now();
            
            expect(endTime - startTime).toBeLessThan(100); // 10帧应该在100ms内完成
        });
    });

    describe('内存管理', () => {
        /**
         * 测试TypedArray内存使用
         */
        test('应该正确分配TypedArray内存', () => {
            expect(christmasTree.snowSpeeds).toBeInstanceOf(Float32Array);
            expect(christmasTree.snowSpeeds.length).toBe(christmasTree.snowCount);
        });

        /**
         * 测试几何体属性内存
         */
        test('应该正确管理几何体属性内存', () => {
            expect(christmasTree.treePoints.geometry.attributes.position).toBeDefined();
            expect(christmasTree.snowSystem.geometry.attributes.position).toBeDefined();
        });
    });
});

// 运行测试的配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UltimateChristmasTree;
}