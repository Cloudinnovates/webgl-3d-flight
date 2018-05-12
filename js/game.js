var SCREEN_WIDTH = window.innerWidth,
    SCREEN_HEIGHT = window.innerHeight,
    QUART_SCREEN = window.innerWidth / 4,
    loaded = 0,
    itemsToLoad = 2,
    windowHalfX = window.innerWidth / 2,
    windowHalfY = window.innerHeight / 2,
    camera, scene, renderer, ship, c, m, o, l, active, inactive, raycaster, SPEED, dead, delta, score, scoreEl, pCounter = 0,
    playing = false;
var textureLoader = new THREE.TextureLoader();
var composer, filmPass, renderPass, copyPass, effectVignette, shaderTime = 0;
var mobile = isMobileDevice();

var titlePane = document.getElementById("titlePane");
var clock = new THREE.Clock();

document.addEventListener('mousemove', onDocumentMouseMove, false);
document.addEventListener('touchstart', onDocumentTouchStart, false);
document.addEventListener('touchmove', onDocumentTouchMove, false);
window.addEventListener('resize', onWindowResize, false);

function isMobileDevice() {
    //this is used to reduce the number of post processing fx and turn off soft shadows on mobile to help it run faster
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
};

function sceneSet() {
    var container = document.createElement('div');
    document.body.appendChild(container);
    scoreEl = document.getElementById('score');

    camera = new THREE.PerspectiveCamera(75, SCREEN_WIDTH / SCREEN_HEIGHT, 1, 10000);
    camera.position.set(0, 6, 18);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xb6d9e6, 0.005);

    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor(0xadc9d4);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    renderer.shadowMap.enabled = true;
    if (!mobile) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    var light = new THREE.HemisphereLight(0xa1e2f5, 0x6f4d25, 0.5);
    scene.add(light);

    light = new THREE.SpotLight(0xfff6c7, 0.5);
    light.position.set(0, 200, -20);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow = new THREE.LightShadow(new THREE.PerspectiveCamera(90, 1, 90, 5000));
    light.shadow.bias = 0.0008;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.penumbra = 1;
    light.decay = 5;
    scene.add(light);
}

function postFX() {
    //POST PROCESSING
    //Create Shader Passes
    renderPass = new THREE.RenderPass(scene, camera);

    if (!mobile) {
        hblur = new THREE.ShaderPass(THREE.HorizontalTiltShiftShader);
        vblur = new THREE.ShaderPass(THREE.VerticalTiltShiftShader);
        effectVignette = new THREE.ShaderPass(THREE.VignetteShader);
    }

    filmPass = new THREE.ShaderPass(THREE.FilmShader);
    copyPass = new THREE.ShaderPass(THREE.CopyShader);
    composer = new THREE.EffectComposer(renderer);

    composer.addPass(renderPass);

    if (!mobile) {
        composer.addPass(hblur);
        composer.addPass(vblur);
    }
   
    composer.addPass(filmPass);
   
    if (!mobile) composer.addPass(effectVignette);

    composer.addPass(copyPass);
    copyPass.renderToScreen = true;

    params();
}

function params() {
    var bluriness = 5;

    if (!mobile) {
        hblur.uniforms['h'].value = bluriness / window.innerWidth;
        vblur.uniforms['v'].value = bluriness / window.innerHeight;
        hblur.uniforms['r'].value = vblur.uniforms['r'].value = 0.5;
        effectVignette.uniforms["offset"].value = 0.95;
        effectVignette.uniforms["darkness"].value = 1.8;
    }

    filmPass.uniforms.grayscale.value = 0;
    filmPass.uniforms['sCount'].value = 0;
    filmPass.uniforms['sIntensity'].value = 0.4;
    filmPass.uniforms['nIntensity'].value = 0.15;
}

function checkLoad() {
    loaded++;

    if (loaded == itemsToLoad) {
        render();
        document.getElementById("preloader").style.visibility = 'hidden';
    }
}

function onWindowResize() {
    SCREEN_WIDTH = window.innerWidth;
    QUART_SCREEN = window.innerWidth / 4;
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function map(n, start1, stop1, start2, stop2) {
    return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}

function onDocumentMouseMove(event) {
    mouseX = event.clientX;
}

function onDocumentTouchStart(event) {

    if (event.touches.length > 1) {
        event.preventDefault();
        mouseX = event.touches[0].pageX;
    }
}

function onDocumentTouchMove(event) {

    if (event.touches.length == 1) {
        event.preventDefault();
        mouseX = event.touches[0].pageX;
    }
}

function beginGame() {

    if (screenfull.enabled) screenfull.request();
    mouseX = windowHalfX;
    mouseY = windowHalfY;

    dead = false;
    filmPass.uniforms.grayscale.value = 0;

    score = 0;
    SPEED = 90;
    clock.start();

    active = [];
    ship.position.set(0, 0, 6);
    ship.rotation.y = 0;
    
    ///////////// BUILD PANELS HERE /////////////

    titlePane.style.visibility = 'hidden'; 
    playing = true;
}

function gameOver() {
    
    titlePane.style.visibility = 'visible';
    filmPass.uniforms.grayscale.value = 1;

    //loop through active length and remove them from array adding them to inactive
    for (i = active.length - 1; i >= 0; i--) {
        
        var mdl = active[i];
        active.splice(i, 1);
        scene.remove(mdl.obj);
        inactive.push(mdl);
    }

    clock.stop();
}

function init() {
    sceneSet();
    postFX();
    inactive = [];
    raycaster = new THREE.Raycaster();
    raycaster.ray.direction.set(0, 0, -1);

    var loader = new THREE.ColladaLoader();
    loader.options.convertUpAxis = true;

    loader.load('./models/fighter.dae', function (collada) {

        var dae = collada.scene;

        dae.traverse(function (child) {

            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        dae.scale.x = dae.scale.y = dae.scale.z = 0.5;
        dae.updateMatrix();
        ship = dae;
        ship.position.set(0, 0, 6);
        ship.rotation.y = 0;
        scene.add(ship);

        mouseX = windowHalfX;
        checkLoad();
    });

    var loader2 = new THREE.ColladaLoader();
    loader2.options.convertUpAxis = true;

    loader2.load('./models/panels.dae', function (collada) {
    
        var dae = collada.scene;
    
        dae.traverse(function (child) {
    
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        dae.scale.x = dae.scale.y = dae.scale.z = 0.5;
        dae.updateMatrix();

        ///////////// PANEL SETUP TO DO /////////////

        scene.add(dae);
        checkLoad();
    });
}

function render() {
    
    requestAnimationFrame(render);
    delta = clock.getDelta();

    if (playing) {
        
        ///////////// UPDATE PANELS TO DO HERE /////////////
        
        updateShip();
        score++;
        scoreEl.innerHTML = "Score:<br>" + score;
    }

    camera.position.x += (ship.position.x - (camera.position.x)) * .07;
    camera.position.y += ((ship.position.y + 6) - camera.position.y) * .08;
    camera.lookAt(new THREE.Vector3(0, ship.position.y + 1, ship.position.z - 9));

    shaderTime += 0.1;
    filmPass.uniforms['time'].value = shaderTime;
    composer.render(0.1);
    
    ///////////// COLLISION TEST TO DO HERE /////////////
    
    if (dead == true && playing == true) {

        playing = false;
        gameOver();
    }
}

init();

function updateShip() {
    var newX = map(mouseX, QUART_SCREEN, QUART_SCREEN * 3, -15, 15);
    ship.position.x += ((newX) - ship.position.x) * 0.05;
    if (ship.position.x < -15) ship.position.x = -15;
    if (ship.position.x > 15) ship.position.x = 15;
    ship.rotation.z = (ship.position.x - newX) * 0.1;
}
