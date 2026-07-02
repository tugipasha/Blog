import * as THREE from 'three';
import {
  vertexShader,
  fluidFragmentShader,
  displayFragmentShader,
} from './shaders.js';

const CONFIG = {
  simSize: 500,
  decay: 0.97,
  lineWidth: 0.09,
  perFrameIntensity: 0.3,
  revealThreshold: 0.02,
  edgeWidthBase: 0.004,
  haloUpperMul: 2.0,
  haloMixStrength: 0.35,
  haloGray: [0.12, 0.12, 0.12],
  idleThresholdMs: 2500,
  idleEaseInMs: 1500,
  autoLerp: 0.05,
  stopAfterMs: 50,
  maxTextureSize: 4096,
};

const canvas = document.querySelector('.hero canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  precision: 'highp',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const simScene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const rtOptions = {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  type: THREE.FloatType,
};

const pingPong = [
  new THREE.WebGLRenderTarget(CONFIG.simSize, CONFIG.simSize, rtOptions),
  new THREE.WebGLRenderTarget(CONFIG.simSize, CONFIG.simSize, rtOptions),
];

let currentTarget = 0;
renderer.setRenderTarget(pingPong[0]);
renderer.clear();
renderer.setRenderTarget(pingPong[1]);
renderer.clear();
renderer.setRenderTarget(null);

const mouse = new THREE.Vector2(0.5, 0.5);
const prevMouse = new THREE.Vector2(0.5, 0.5);
let isMoving = false;
let lastMoveTime = 0;

const autoMouse = new THREE.Vector2(0.5, 0.5);
const prevAutoMouse = new THREE.Vector2(0.5, 0.5);

function createPlaceholderTexture(hexColor) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 5;
  const ctx = c.getContext('2d');
  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, 4, 5);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

const topTexture = createPlaceholderTexture('#0000ff');
const bottomTexture = createPlaceholderTexture('#ff0000');
const topTextureSize = new THREE.Vector2(4, 5);
const bottomTextureSize = new THREE.Vector2(4, 5);

function downscaleImage(img, maxSize) {
  let { width, height } = img;
  if (width <= maxSize && height <= maxSize) return img;

  const scale = maxSize / Math.max(width, height);
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const scaled = new Image();
  scaled.src = c.toDataURL('image/png');
  return new Promise((resolve) => {
    scaled.onload = () => resolve(scaled);
  });
}

function loadPortrait(src, label) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = async () => {
      try {
        let finalImg = img;
        if (img.width > CONFIG.maxTextureSize || img.height > CONFIG.maxTextureSize) {
          finalImg = await downscaleImage(img, CONFIG.maxTextureSize);
        }
        const c = document.createElement('canvas');
        c.width = finalImg.width;
        c.height = finalImg.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(finalImg, 0, 0);
        const tex = new THREE.CanvasTexture(c);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        console.log(`[TOLGA] Loaded ${label}: ${finalImg.width}×${finalImg.height}`);
        resolve({ tex, size: new THREE.Vector2(finalImg.width, finalImg.height) });
      } catch (err) {
        console.error(`[TOLGA] Error processing ${label}:`, err);
        reject(err);
      }
    };
    img.onerror = () => {
      console.error(`[TOLGA] Failed to load ${label} from ${src}`);
      reject(new Error(`Failed to load ${src}`));
    };
    img.src = src;
  });
}

loadPortrait('/portrait_top.png', 'portrait_top')
  .then(({ tex, size }) => {
    topTexture.dispose();
    displayMaterial.uniforms.uTopTexture.value = tex;
    displayMaterial.uniforms.uTopTextureSize.value.copy(size);
  })
  .catch(() => {});

loadPortrait('/portrait_bottom.png', 'portrait_bottom')
  .then(({ tex, size }) => {
    bottomTexture.dispose();
    displayMaterial.uniforms.uBottomTexture.value = tex;
    displayMaterial.uniforms.uBottomTextureSize.value.copy(size);
  })
  .catch(() => {});

const dpr = Math.min(window.devicePixelRatio, 2);

const trailsMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader: fluidFragmentShader,
  uniforms: {
    uPrevTrails: { value: pingPong[0].texture },
    uMouse: { value: mouse.clone() },
    uPrevMouse: { value: prevMouse.clone() },
    uResolution: { value: new THREE.Vector2(CONFIG.simSize, CONFIG.simSize) },
    uDecay: { value: CONFIG.decay },
    uIsMoving: { value: false },
  },
});

const displayMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader: displayFragmentShader,
  uniforms: {
    uFluid: { value: pingPong[0].texture },
    uTopTexture: { value: topTexture },
    uBottomTexture: { value: bottomTexture },
    uResolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
    uTopTextureSize: { value: topTextureSize.clone() },
    uBottomTextureSize: { value: bottomTextureSize.clone() },
    uDpr: { value: dpr },
  },
});

const geometry = new THREE.PlaneGeometry(2, 2);
const simMesh = new THREE.Mesh(geometry, trailsMaterial);
const displayMesh = new THREE.Mesh(geometry, displayMaterial);
simScene.add(simMesh);
scene.add(displayMesh);

function updatePointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const now = performance.now();

  if (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  ) {
    prevMouse.copy(mouse);
    mouse.x = (clientX - rect.left) / rect.width;
    mouse.y = 1 - (clientY - rect.top) / rect.height;
    isMoving = true;
    lastMoveTime = now;
  } else {
    isMoving = false;
  }
}

canvas.addEventListener('mousemove', (e) => {
  updatePointer(e.clientX, e.clientY);
});

canvas.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 0) {
      e.preventDefault();
      updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    }
  },
  { passive: false }
);

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const newDpr = Math.min(window.devicePixelRatio, 2);
  renderer.setSize(w, h);
  renderer.setPixelRatio(newDpr);
  displayMaterial.uniforms.uResolution.value.set(w, h);
  displayMaterial.uniforms.uDpr.value = newDpr;
});

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();

  if (isMoving && now - lastMoveTime > CONFIG.stopAfterMs) {
    isMoving = false;
  }

  const idleTime = now - lastMoveTime;
  const autoActive = idleTime > CONFIG.idleThresholdMs;

  const prevTarget = pingPong[currentTarget];
  currentTarget = (currentTarget + 1) % 2;
  const writeTarget = pingPong[currentTarget];

  trailsMaterial.uniforms.uPrevTrails.value = prevTarget.texture;

  if (autoActive) {
    const easeIn = Math.min(
      1,
      (idleTime - CONFIG.idleThresholdMs) / CONFIG.idleEaseInMs
    );
    const t = now * 0.001;
    const targetX =
      0.5 + 0.30 * Math.sin(t * 0.41) + 0.12 * Math.sin(t * 0.93 + 1.3);
    const targetY =
      0.5 + 0.28 * Math.cos(t * 0.37 + 0.5) + 0.10 * Math.cos(t * 1.11 + 2.7);

    prevAutoMouse.copy(autoMouse);
    autoMouse.x += (targetX - autoMouse.x) * CONFIG.autoLerp * easeIn;
    autoMouse.y += (targetY - autoMouse.y) * CONFIG.autoLerp * easeIn;

    trailsMaterial.uniforms.uMouse.value.copy(autoMouse);
    trailsMaterial.uniforms.uPrevMouse.value.copy(prevAutoMouse);
    trailsMaterial.uniforms.uIsMoving.value = true;

    mouse.copy(autoMouse);
    prevMouse.copy(prevAutoMouse);
  } else {
    trailsMaterial.uniforms.uMouse.value.copy(mouse);
    trailsMaterial.uniforms.uPrevMouse.value.copy(prevMouse);
    trailsMaterial.uniforms.uIsMoving.value = isMoving;

    autoMouse.copy(mouse);
    prevAutoMouse.copy(mouse);
  }

  renderer.setRenderTarget(writeTarget);
  renderer.render(simScene, camera);

  displayMaterial.uniforms.uFluid.value = writeTarget.texture;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
}

animate();

const contactForm = document.getElementById('contact-form');

if (contactForm) {
  const statusEl = document.getElementById('contact-status');
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const submitLabel = submitButton ? submitButton.innerHTML : '';
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validators = {
    name(value) {
      if (!value) return 'Please enter your name.';
      if (value.length < 2) return 'Name must be at least 2 characters.';
      return '';
    },
    email(value) {
      if (!value) return 'Please enter your email address.';
      if (!emailPattern.test(value)) return 'Enter a valid email address.';
      return '';
    },
    subject(value) {
      if (!value) return 'Please add a subject line.';
      if (value.length < 4) return 'Subject must be at least 4 characters.';
      return '';
    },
    message(value) {
      if (!value) return 'Please describe your project or request.';
      if (value.length < 20) return 'Message must be at least 20 characters.';
      return '';
    },
  };

  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error');
    if (type) {
      statusEl.classList.add(type);
    }
  }

  function getErrorElement(field) {
    return document.getElementById(`${field.id}-error`);
  }

  function setFieldError(field, message) {
    const errorEl = getErrorElement(field);
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (errorEl) {
      errorEl.textContent = message;
    }
  }

  function normalizeValue(field) {
    const trimmed = field.value.trim();
    return field.tagName === 'TEXTAREA'
      ? trimmed.replace(/\n{3,}/g, '\n\n')
      : trimmed.replace(/\s+/g, ' ');
  }

  function validateField(field) {
    const validator = validators[field.name];
    if (!validator) return true;

    const value = normalizeValue(field);
    const message = validator(value);
    setFieldError(field, message);
    return !message;
  }

  function clearErrors() {
    Object.keys(validators).forEach((name) => {
      const field = contactForm.elements.namedItem(name);
      if (field instanceof HTMLElement) {
        setFieldError(field, '');
      }
    });
  }

  Object.keys(validators).forEach((name) => {
    const field = contactForm.elements.namedItem(name);
    if (!(field instanceof HTMLElement)) return;

    field.addEventListener('blur', () => {
      validateField(field);
    });

    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') {
        validateField(field);
      }
    });
  });

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fields = Object.keys(validators)
      .map((name) => contactForm.elements.namedItem(name))
      .filter((field) => field instanceof HTMLElement);

    const isValid = fields.every((field) => validateField(field));

    if (!isValid) {
      setStatus('Please fix the highlighted fields and try again.', 'is-error');
      const firstInvalid = fields.find(
        (field) => field.getAttribute('aria-invalid') === 'true'
      );
      firstInvalid?.focus();
      return;
    }

    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = 'Sending...';
      }

      setStatus('Sending your message securely...');

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (result.fields && typeof result.fields === 'object') {
          Object.entries(result.fields).forEach(([name, message]) => {
            const field = contactForm.elements.namedItem(name);
            if (field instanceof HTMLElement) {
              setFieldError(field, String(message));
            }
          });
        }

        throw new Error(result.error || 'Unable to send your message right now.');
      }

      contactForm.reset();
      clearErrors();
      setStatus('Message sent successfully. I will get back to you soon.', 'is-success');
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Unable to send your message right now.',
        'is-error'
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = submitLabel;
      }
    }
  });
}
