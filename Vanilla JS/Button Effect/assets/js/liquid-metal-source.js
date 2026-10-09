// Official Paper Liquid Metal, bundled locally for standalone/file:// use.
// Apache-2.0; see ../vendor/paper-shaders/LICENSE and NOTICE.
import { ShaderMount, liquidMetalFragmentShader, LiquidMetalShapes, ShaderFitOptions } from '@paper-design/shaders';

// Edit these HEX colors, then run npm run build.
const COLORS = {
  back: '#F8F8DA',
  tint: '#F8F8DA',
  dark: '#B7F1D1', // Replaces black in the metal pattern.
};

// Accept #RGB, #RGBA, #RRGGBB or #RRGGBBAA; shader channels use 0–1.
function hexToRgba(hex) {
  let value = hex.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
    throw new Error(`Invalid HEX color: ${hex}`);
  }
  if (value.length <= 4) value = [...value].map(channel => channel + channel).join('');
  if (value.length === 6) value += 'FF';
  return value.match(/../g).map(channel => parseInt(channel, 16) / 255);
}

// CSS pixels: preserve the original capsule, fading only OUTSIDE its perimeter.
const EDGE_BLUR = { radius: 8, width: 10, padding: 10 };
const mainStart = liquidMetalFragmentShader.indexOf('void main() {');
if (mainStart < 0) throw new Error('Paper shader main function changed.');
const shaderHeader = liquidMetalFragmentShader.slice(0, mainStart);
const sampleBody = liquidMetalFragmentShader.slice(mainStart)
  .replace('void main() {', 'vec4 sampleMetal(vec2 objectUV, vec2 responsiveUV, vec2 imageUV) {')
  .replaceAll('v_objectUV', 'objectUV')
  .replaceAll('v_responsiveUV', 'responsiveUV')
  .replaceAll('v_imageUV', 'imageUV')
  .replace('fragColor = vec4(color, opacity);', 'return vec4(mix(color, mix(u_colorDark.rgb, vec3(1.0), clamp(color, 0.0, 1.0)), u_colorDark.a), opacity);');

// Local modification of Paper's shader: a nine-tap Gaussian texture blur
// plus a soft outer contour. The original capsule remains fully opaque.
const edgeBlurShader = `${shaderHeader}
uniform float u_edgeBlurRadius;
uniform float u_edgeBlurWidth;
uniform float u_cssHeight;
uniform vec2 u_buttonSize;
uniform vec4 u_colorDark;
${sampleBody}
void main() {
  vec2 objectDx = dFdx(v_objectUV), objectDy = dFdy(v_objectUV);
  vec2 responsiveDx = dFdx(v_responsiveUV), responsiveDy = dFdy(v_responsiveUV);
  vec2 imageDx = dFdx(v_imageUV), imageDy = dFdy(v_imageUV);
  float pixelRatio = u_resolution.y / max(u_cssHeight, 1.0);
  vec2 halfSize = u_buttonSize * pixelRatio * 0.5;
  vec2 p = gl_FragCoord.xy - u_resolution * 0.5;
  // Signed distance to the full-size button capsule; negative inside.
  vec2 q = vec2(max(abs(p.x) - (halfSize.x - halfSize.y), 0.0), p.y);
  float signedDistance = length(q) - halfSize.y;
  float coverage = 1.0 - smoothstep(0.0, max(u_edgeBlurRadius * pixelRatio, 0.001), signedDistance);
  float insideDistance = max(0.0, -signedDistance);
  float edgeWeight = u_edgeBlurWidth > 0.0
    ? 1.0 - smoothstep(0.0, u_edgeBlurWidth * pixelRatio, insideDistance)
    : 0.0;
  vec4 center = sampleMetal(v_objectUV, v_responsiveUV, v_imageUV);
  if (edgeWeight < 0.001 || u_edgeBlurRadius <= 0.0) {
    fragColor = vec4(center.rgb * coverage, coverage);
    return;
  }
  float radius = u_edgeBlurRadius * pixelRatio;
  vec3 blurred = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y)) * radius;
      // Clamp samples to the texture's bounds instead of sampling background.
      offset = clamp(gl_FragCoord.xy + offset, vec2(0.5), u_resolution - 0.5) - gl_FragCoord.xy;
      float weight = (x == 0 ? 2.0 : 1.0) * (y == 0 ? 2.0 : 1.0);
      blurred += weight * sampleMetal(
        v_objectUV + objectDx * offset.x + objectDy * offset.y,
        v_responsiveUV + responsiveDx * offset.x + responsiveDy * offset.y,
        v_imageUV + imageDx * offset.x + imageDy * offset.y
      ).rgb;
    }
  }
  fragColor = vec4(mix(center.rgb, blurred / 16.0, edgeWeight) * coverage, coverage);
}
`;

window.createButtonLiquidMetal = container => {
  // Leave room for the soft contour rather than clipping it at the old bounds.
  container.style.inset = `${-EDGE_BLUR.padding}px`;
  return new ShaderMount(container, edgeBlurShader, {
  u_edgeBlurRadius: EDGE_BLUR.radius,
  u_edgeBlurWidth: EDGE_BLUR.width,
  u_cssHeight: container.clientHeight,
  u_buttonSize: [container.parentElement.clientWidth, container.parentElement.clientHeight],
  u_colorBack: hexToRgba(COLORS.back),
  u_colorTint: hexToRgba(COLORS.tint),
  u_colorDark: hexToRgba(COLORS.dark),
  u_repetition: 2,
  u_softness: 4,
  u_shiftRed: 0,
  u_shiftBlue: 0,
  u_distortion: 0.07,
  u_contour: 0.4,
  u_angle: 180,
  u_shape: LiquidMetalShapes.none,
  u_isImage: false,
  u_fit: ShaderFitOptions.cover,
  u_scale: 1.05,
  u_rotation: 0,
  u_offsetX: 0,
  u_offsetY: 0,
  u_originX: 0.5,
  u_originY: 0.5,
  u_worldWidth: 0,
  u_worldHeight: 0,
}, { alpha: true, premultipliedAlpha: true, antialias: false }, 0, 0, 2, 512000);
};
