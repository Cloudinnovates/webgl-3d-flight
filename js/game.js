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
    
    buildPanels();

    titlePane.style.visibility = 'hidden'; 
    console.log("start");
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

        console.log(active);
        console.log(inactive);
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

        /////////////SET-UP Cyan Panel ///////////////
        var x = dae.getObjectByName("Cyan", true);
        c = new Cyan(x);
        //push the enemy blocks into Cyan's enemies array - doesn't seem to work from inside the Cyan object!
        x.traverse(function (child) {

            if (child instanceof THREE.Mesh && child.parent.name == "enemy") {

                c.enemies.push(child.parent);
            }
        });

        inactive.push(c);

        /////////////SET-UP Magenta Panel ///////////////
        x = dae.getObjectByName("Mag", true);
        m = new Mag(x);

        x.traverse(function (child) {

            if (child instanceof THREE.Mesh && child.parent.name == "enemyL") {

                m.l_enemies.push(child.parent);

                child.parent.update = function () {

                    if (this.position.x < 5) {

                        this.position.x += (120 * delta);
                    }
                }
            }
            if (child instanceof THREE.Mesh && child.parent.name == "enemyR") {

                m.r_enemies.push(child.parent);

                child.parent.update = function () {

                    if (this.position.x > -5) {

                        this.position.x -= (120 * delta);
                    }
                }
            }
        });

        inactive.push(m);

        /////////////SET-UP Orange Panel ///////////////
        x = dae.getObjectByName("Oj", true);
        o = new Oj(x);
        o.enemies = [];

        x.traverse(function (child) {

            if (child instanceof THREE.Mesh && child.parent.name == "stick") {

                o.enemies.push(child.parent);
            }
        });

        inactive.push(o);

        /////////////SET-UP Lime Panel ///////////////
        var x = dae.getObjectByName("Lime", true);
        l = new Lime(x);
        l.init();
        inactive.push(l);

        checkLoad();
    });
}


function buildPanels() {

    //first build - add the lime panel
    if (active.length == 0) {
    
        for (i = 0; i < inactive.length; i++) {
    
            if (inactive[i].obj.name == "Lime") {
    
                var pln = inactive[i];
                active.push(pln);
                scene.add(pln.obj);
                pln.reset();
                pln.obj.position.z = 10;
                inactive.splice(i, 1);
            }
        }
    }

    addRndm();
}

function addRndm() {

    var amnt = inactive.length;
    var rndm = Math.floor(Math.random() * amnt);
    var mdl = inactive[rndm];
    mdl.reset();
    mdl.obj.position.z = active[0].obj.position.z - 500;
    scene.add(mdl.obj);
    console.log(mdl.obj.position.z);
    active.push(mdl);
    inactive.splice(rndm, 1);

    console.log("******BUILD ******* ");
    
    for (i = 0; i < active.length; i++) {
    
        console.log("Active panel " + i);
        console.log(active[i]);
    }
    for (i = 0; i < inactive.length; i++) {
    
        console.log("Inactive panel " + i);
        console.log(inactive[i]);
    }
    //update panel count and increase speed every 8
    pCounter += 1;

    if (pCounter %= 2) {
    
        if (SPEED < 3) {
    
            SPEED += 5;
            console.log(SPEED);
        }
    }

}

function render() {
    
    requestAnimationFrame(render);
    delta = clock.getDelta();

    if (playing) {
        
        updatePanels();
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
    
    collisionTest();
    
    if (dead == true && playing == true) {

        playing = false;
        gameOver();
    }
}

init();

function updatePanels() {

    for (i = active.length - 1; i >= 0; i--) {

        var mdl = active[i];
        mdl.update();

        if (mdl.obj.position.z >= 520) {

            active.splice(i, 1);
            scene.remove(mdl.obj);
            inactive.push(mdl);
            buildPanels();
        }
    }
}

function updateShip() {

    var newX = map(mouseX, QUART_SCREEN, QUART_SCREEN * 3, -15, 15);
    ship.position.x += ((newX) - ship.position.x) * 0.05;
    if (ship.position.x < -15) ship.position.x = -15;
    if (ship.position.x > 15) ship.position.x = 15;
    ship.rotation.z = (ship.position.x - newX) * 0.1;
}

function collisionTest() {
    // collision detection - firing 2 rays for each side of the ship
    for (var i = 0; i < 2; i++) {

        var originPoint = ship.position.clone();
        originPoint.x += (i * 2.6) - 1.3;
        raycaster.ray.origin.copy(originPoint);
        let intersections = raycaster.intersectObjects(scene.children, true);
        
        if (intersections.length > 0) {
        
            var distance = intersections[0].distance;
            console.log(distance);
            console.log(intersections[0]);
        
            if (distance < 3.5) {
        
                console.log("dead");
                dead = true;
                distance = null;
                break;
            }
        }
    }
}

//track sections

function Cyan(obj) {
    this.obj = obj;
    this.enemies = [];
}
Cyan.prototype.reset = function () {

    for (var i = 0; i < this.enemies.length; i++) {
        
        let rpos = Math.floor(Math.random() * 6);
        this.enemies[i].position.x = (rpos * 9) - 18;
    }
};

Cyan.prototype.update = function () {
    this.obj.position.z += (SPEED * delta);
};

function Mag(obj) {
    this.obj = obj;
    this.enemies = [];
    this.l_enemies = []; 
    this.r_enemies = [];
}
Mag.prototype.reset = function () {

    for (var i = 0; i < m.l_enemies.length; i++) {

        this.l_enemies[i].position.x = -30;
        this.r_enemies[i].position.x = 30;
    }

    this.enemies = [];

    for (var i = 0; i < 4; i++) {

        let rnd = Math.floor(Math.random() * 2);
        
        if (rnd == 1) {
            this.enemies.push(this.l_enemies[i]);
        } else {
            this.enemies.push(this.r_enemies[i]);
        }
    }
};

Mag.prototype.update = function () {

    this.obj.position.z += (SPEED * delta);

    if (this.obj.position.z > -10) {
        this.enemies[0].update();
    }
    if (this.obj.position.z > 80) {
        this.enemies[1].update();
    }
    if (this.obj.position.z > 170) {
        this.enemies[2].update();
    }
    if (this.obj.position.z > 280) {
        this.enemies[3].update();
    }
};

function Oj(obj) {
    this.obj = obj;
    this.enemies = [];
}

Oj.prototype.reset = function () {

    for (var i = 0; i < this.enemies.length; i++) {
    
        let rpos = Math.floor(Math.random() * 4);
        this.enemies[i].position.x = (rpos * 10) - 25;
        this.enemies[i].rotation.z = Math.PI; 
        this.enemies[i].add(this.snd);
    }
};

Oj.prototype.update = function () {

    this.obj.position.z += (SPEED * delta);
    
    if (this.obj.position.z > -10) {
    
        this.enemies[0].rotation.z -= 0.05;
        this.enemies[0].children[1].rotation.z += delta * (Math.PI * 2);
    }
    if (this.obj.position.z > 85) {
    
        this.enemies[1].rotation.z -= 0.05;
        this.enemies[1].children[1].rotation.z += delta * (Math.PI * 2);
    }
    if (this.obj.position.z > 175) {
    
        this.enemies[2].rotation.z -= 0.05;
        this.enemies[2].children[1].rotation.z += delta * (Math.PI * 2);
    }
};

function Lime(obj) {
    this.obj = obj;
    this.tubes;
    this.init();
}

Lime.prototype.init = function () {
    this.tubes = this.obj.getObjectByName("Tubes", true);
};

Lime.prototype.reset = function () {}

Lime.prototype.update = function () {
    
    this.obj.position.z += (SPEED * delta);
    this.tubes.rotation.z += 0.01;
};

function getRand(minVal, maxVal) {
    return minVal + (Math.random() * (maxVal - minVal));
}







