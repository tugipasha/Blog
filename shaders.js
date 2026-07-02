export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fluidFragmentShader = /* glsl */ `
  uniform sampler2D uPrevTrails;
  uniform vec2 uMouse;
  uniform vec2 uPrevMouse;
  uniform vec2 uResolution;
  uniform float uDecay;
  uniform bool uIsMoving;
  varying vec2 vUv;

  void main() {
    vec4 prev = texture2D(uPrevTrails, vUv);
    float newValue = prev.r * uDecay;

    if (uIsMoving) {
      vec2 dir = uMouse - uPrevMouse;
      float len = length(dir);
      if (len > 0.001) {
        vec2 d = dir / len;
        vec2 toPx = vUv - uPrevMouse;
        float proj = clamp(dot(toPx, d), 0.0, len);
        vec2 closest = uPrevMouse + proj * d;
        float dist = length(vUv - closest);
        float lineWidth = 0.09;
        float intensity = smoothstep(lineWidth, 0.0, dist) * 0.3;
        newValue += intensity;
      }
    }

    gl_FragColor = vec4(newValue, 0.0, 0.0, 1.0);
  }
`;

export const displayFragmentShader = /* glsl */ `
  uniform sampler2D uFluid;
  uniform sampler2D uTopTexture;
  uniform sampler2D uBottomTexture;
  uniform vec2 uResolution;
  uniform vec2 uTopTextureSize;
  uniform vec2 uBottomTextureSize;
  uniform float uDpr;
  varying vec2 vUv;

  vec2 getCoverUV(vec2 uv, vec2 ts) {
    if (ts.x < 1.0 || ts.y < 1.0) return uv;
    vec2 s = uResolution / ts;
    float scale = max(s.x, s.y);
    vec2 scaled = ts * scale;
    vec2 offset = (uResolution - scaled) * 0.5;
    return (uv * uResolution - offset) / scaled;
  }

  void main() {
    float fluid = texture2D(uFluid, vUv).r;
    vec2 topUV = getCoverUV(vUv, uTopTextureSize);
    vec2 bottomUV = getCoverUV(vUv, uBottomTextureSize);
    vec4 topColor = texture2D(uTopTexture, topUV);
    vec4 bottomColor = texture2D(uBottomTexture, bottomUV);

    float threshold = 0.02;
    float edgeWidth = 0.004 / uDpr;
    float t = smoothstep(threshold, threshold + edgeWidth, fluid);

    float halo = smoothstep(0.0, threshold * 2.0, fluid) * (1.0 - t);
    vec3 trailGray = vec3(0.12);
    vec3 tintedTop = mix(topColor.rgb, trailGray, halo * 0.35);
    vec4 finalColor = mix(vec4(tintedTop, topColor.a), bottomColor, t);

    gl_FragColor = finalColor;
  }
`;
