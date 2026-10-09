// Liquid Orb (WebGPU) behind the CTA — replaces the blue glow. Shader, state seeds and
// render loop are specialized for the Dusk palette:
//  - it draws into <canvas data-dw="orb"> inside the card instead of a full-page canvas;
//  - on any WebGPU failure it stays hidden and the SVG glow (assets/img/glow.svg) shows;
//  - with prefers-reduced-motion the orb is drawn but its time does not advance.
// API: window.liquidOrb.setState('idle' | 'thinking'), setAudioBands({ low, mid, high, all }).
(() => {
    // Color blending: 0 = separate, 0.2 = subtle, 0.5 = soft edges, 1 = full blending.
    const COLOR_BLEND = 0.6;
    const DRAG_SPEED_MULTIPLIER = 20; // Animation speed while dragging the amount slider.

    const shaderSource = "// Dusk-only shader. Uniform layout preserved for state and interaction controls.\nstruct Uniforms {\n  size:           vec2<f32>,\n  time:           f32,\n  speed:          f32,\n  radius:         f32,\n  zoom:           f32,\n  warp:           f32,\n  ridgeAmt:       f32,\n  sharp:          f32,\n  shade:          f32,\n  sheen:          f32,\n  gloss:          f32,\n  shellMidAlpha:  f32,\n  shellEdgeAlpha: f32,\n  exposure:       f32,\n  style:          f32,\n  edgeSoftness:   f32,\n  edgeGlow:       f32,\n  paletteCount:   f32,\n  glassEnabled:   f32,\n  glassOpacity:   f32,\n  contourDeform:  f32,\n  bandDensity:    f32,\n  chromaticShift: f32,\n  metalScale:     f32,\n  metalStretch:   f32,\n  metalAngle:     f32,\n  metalOffset:    f32,\n  metalPhase:     f32,\n  metalEvolution: f32,\n  metalRoughness: f32,\n  metalDepth:     f32,\n  particleDensity: f32,\n  ribbonCount:     f32,\n  ribbonWidth:     f32,\n  ribbonTwist:     f32,\n  ribbonFold:      f32,\n  ribbonBreath:    f32,\n  particleSize:    f32,\n  particleBloom:   f32,\n  colorA:         vec4<f32>,\n  colorB:         vec4<f32>,\n  colorC:         vec4<f32>,\n  colorD:         vec4<f32>,\n  highlightColor: vec4<f32>,\n  shellInner:     vec4<f32>,\n  shellMid:       vec4<f32>,\n  shellEdge:      vec4<f32>,\n  sheenColor:     vec4<f32>,\n  specColor:      vec4<f32>,\n  canvasColor:    vec4<f32>,\n  glowColor:      vec4<f32>,\n  paletteStop0:    vec4<f32>,\n  paletteStop1:    vec4<f32>,\n  paletteStop2:    vec4<f32>,\n  paletteStop3:    vec4<f32>,\n  paletteStop4:    vec4<f32>,\n  paletteStop5:    vec4<f32>,\n  paletteStop6:    vec4<f32>,\n  paletteStop7:    vec4<f32>,\n  paletteStop8:    vec4<f32>,\n  paletteStop9:    vec4<f32>,\n  paletteStop10:   vec4<f32>,\n  paletteStop11:   vec4<f32>,\n};\n@group(0) @binding(0) var<uniform> u: Uniforms;\n\nconst DW_BASE_SATURATION: f32 = 1.35;\nconst DW_SPOT_SATURATION: f32 = 1.65;\nconst DW_SPOT_CONTRAST: f32 = 1.25;\nconst DW_SPOT_STRENGTH: f32 = 1.30;\nconst DW_COLOR_BLEND: f32 = 0.2;\n\nstruct VOut {\n  @builtin(position) pos: vec4<f32>,\n  @location(0) uv: vec2<f32>,\n};\n\nfn mfEdgeD(soft: f32) -> f32 {\n  return soft - 0.005;\n}\n\nfn mfEdgeGlow(col: vec3<f32>, uv: vec2<f32>, ctr: vec2<f32>, rad: f32,\n              soft: f32, glow: f32, glowRGB: vec3<f32>) -> vec3<f32> {\n  if (glow <= 0.0) { return col; }\n  let r = length(uv - ctr);\n  let outside = smoothstep(rad - max(soft, 0.0005), rad + max(soft, 0.0005), r);\n  return col + glowRGB * (glow * exp(-max(r - rad, 0.0) * 11.0) * outside);\n}\n\nfn glsFinishPresetFluid(colorIn: vec3<f32>, p: vec2<f32>) -> vec3<f32> {\n  var color = colorIn;\n  color = mix(color, u.highlightColor.rgb,\n              u.shade * 0.22 * smoothstep(0.15, 1.15, dot(p, vec2<f32>(-0.32, 0.78))));\n  color = color * (1.0 - u.shade * 0.34\n                  * smoothstep(-0.1, 1.2, dot(p, vec2<f32>(0.45, -0.62))));\n  color = color * (1.0 - u.shade * 0.22 * smoothstep(0.72, 1.08, length(p)));\n  return clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));\n}\n\nfn glsSeparateColor(rgb: vec3<f32>, saturation: f32, contrast: f32) -> vec3<f32> {\n  let luminance = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));\n  let saturated = vec3<f32>(luminance) + (rgb - vec3<f32>(luminance)) * saturation;\n  return clamp((saturated - vec3<f32>(0.5)) * contrast + vec3<f32>(0.5),\n               vec3<f32>(0.0), vec3<f32>(1.0));\n}\n\nfn glsColorSpot(base: vec4<f32>, p: vec2<f32>, center: vec2<f32>,\n                width: f32, phase: f32, t: f32, spot: vec4<f32>) -> vec4<f32> {\n  let drift = vec2<f32>(sin(t * 0.32 + phase), cos(t * 0.27 + phase * 1.3)) * 0.18;\n  let delta = (p - center - drift) / width;\n  let strength = DW_SPOT_STRENGTH;\n  let coverage = exp(-dot(delta, delta) * 1.1) * min(spot.a * strength, 1.0);\n  let spotColor = glsSeparateColor(spot.rgb, DW_SPOT_SATURATION, DW_SPOT_CONTRAST);\n  let boundary = 1.0 - smoothstep(0.0, 0.20, abs(coverage - base.a));\n  let dominant = select(base.rgb, spotColor, coverage > base.a);\n  let neighbor = select(spotColor, base.rgb, coverage > base.a);\n  let edgeMix = mix(dominant, neighbor, min(DW_COLOR_BLEND, 0.5) * boundary);\n  let softMix = mix(base.rgb, spotColor, coverage);\n  let mixed = mix(edgeMix, softMix, smoothstep(0.5, 1.0, DW_COLOR_BLEND));\n  return vec4<f32>(mixed, max(base.a, coverage));\n}\n\nfn glsOpalFluid(position: vec2<f32>, t: f32) -> vec3<f32> {\n  // Irregular domain warp: detail controls patch density, without mirrored tiles.\n  let detail = max(u.bandDensity, 0.1);\n  let domain = position * detail + vec2<f32>(sin(t * 0.11), cos(t * 0.13)) * 0.10;\n  let warpX = dot(domain, vec2<f32>(1.73, 1.19)) + 0.72 * sin(dot(domain, vec2<f32>(-0.87, 2.31)) + t * 0.09 + 1.37);\n  let warpY = dot(domain, vec2<f32>(-1.41, 1.97)) + 0.63 * sin(dot(domain, vec2<f32>(2.17, 0.71)) - t * 0.07 + 2.43);\n  let p = vec2<f32>(sin(warpX + 0.41), sin(warpY - 0.83));\n  let gradient = smoothstep(-1.0, 1.0, p.x * 0.65 - p.y * 0.75);\n  let color = glsSeparateColor(select(u.colorA.rgb, u.colorB.rgb, gradient >= 0.5),\n                               DW_BASE_SATURATION, 1.08);\n  var layer = vec4<f32>(color, 0.22); \n  let flow = p + vec2<f32>(sin(p.y * 2.6 + t * 0.22),\n                          cos(p.x * 2.3 - t * 0.19)) * 0.08;\n  layer = glsColorSpot(layer, flow, vec2<f32>(-0.50, 0.55), 0.48, 0.00, t, u.paletteStop0);\n  layer = glsColorSpot(layer, flow, vec2<f32>(0.35, 0.60), 0.42, 1.70, t, u.paletteStop1);\n  layer = glsColorSpot(layer, flow, vec2<f32>(0.60, 0.05), 0.50, 3.40, t, u.paletteStop2);\n  layer = glsColorSpot(layer, flow, vec2<f32>(-0.65, -0.10), 0.40, 5.10, t, u.paletteStop3);\n  layer = glsColorSpot(layer, flow, vec2<f32>(0.05, 0.15), 0.32, 6.80, t, u.paletteStop4);\n  layer = glsColorSpot(layer, flow, vec2<f32>(-0.20, -0.55), 0.45, 8.50, t, u.paletteStop5);\n  layer = glsColorSpot(layer, flow, vec2<f32>(0.40, -0.50), 0.38, 10.20, t, u.paletteStop6);\n  layer = glsColorSpot(layer, flow, vec2<f32>(-0.05, 0.75), 0.43, 11.90, t, u.paletteStop7);\n  return glsFinishPresetFluid(layer.rgb, position);\n}\n\nfn glsOver(dst: vec3<f32>, src: vec3<f32>, a: f32) -> vec3<f32> {\n  let k = clamp(a, 0.0, 1.0);\n  return src * k + dst * (1.0 - k);\n}\n\nfn glsRefractionProfile(t: f32) -> f32 {\n  let depth = clamp(t, 0.0, 1.0);\n  let circular = sqrt(max(1.0 - (1.0 - depth) * (1.0 - depth), 0.0));\n  return 1.0 - circular;\n}\n\nfn glsHighlightLobe(normal: vec2<f32>, direction: vec2<f32>, cut: f32,\n                     power: f32) -> f32 {\n  let angular = clamp((dot(normal, direction) - cut) / max(1.0 - cut, 0.001),\n                      0.0, 1.0);\n  return pow(angular, power);\n}\n\nfn glsContourWave(angle: f32, t: f32) -> vec2<f32> {\n  let style = i32(u.style + 0.5);\n  if (style == 19) {\n    let wave = sin(angle * 2.0 + t * 0.27) * 0.72\n               + sin(angle * 4.0 - t * 0.16 + 2.1) * 0.28;\n    let slope = cos(angle * 2.0 + t * 0.27) * 1.44\n                + cos(angle * 4.0 - t * 0.16 + 2.1) * 1.12;\n    return vec2<f32>(wave, slope);\n  }\n  let wave = sin(angle * 3.0 + t * 0.62) * 0.52\n             + sin(angle * 5.0 - t * 0.41 + 1.7) * 0.31\n             + sin(angle * 2.0 + t * 0.23 + 3.1) * 0.17;\n  let slope = cos(angle * 3.0 + t * 0.62) * 1.56\n              + cos(angle * 5.0 - t * 0.41 + 1.7) * 1.55\n              + cos(angle * 2.0 + t * 0.23 + 3.1) * 0.34;\n  return vec2<f32>(wave, slope);\n}\n\nfn glsContourStrength() -> f32 {\n  if (u.style >= 18.5) { return 0.11; }\n  return select(0.09, 0.16, u.style >= 15.5);\n}\n\nfn glsContourScale(uv: vec2<f32>, t: f32, amount: f32) -> f32 {\n  if (amount <= 0.0) { return 1.0; }\n  let contour = glsContourWave(atan2(uv.y, uv.x), t);\n  return 1.0 + clamp(amount, 0.0, 1.0) * glsContourStrength() * contour.x;\n}\n\nfn glsContourNormal(uv: vec2<f32>, rad: f32, t: f32, amount: f32) -> vec2<f32> {\n  let distance = length(uv);\n  if (distance <= 0.0001) { return vec2<f32>(0.0); }\n  let radial = uv / distance;\n  let contour = glsContourWave(atan2(uv.y, uv.x), t);\n  let slope = clamp(amount, 0.0, 1.0) * glsContourStrength() * contour.y;\n  let tangent = vec2<f32>(-radial.y, radial.x);\n  return normalize(radial - tangent * (rad * slope / distance));\n}\n\nfn orbGlassLiquidAnim(uv01: vec2<f32>) -> vec4<f32> {\n  let fc = vec2<f32>(uv01.x, 1.0 - uv01.y) * u.size;\n  let uv = (2.0 * fc - u.size) / max(min(u.size.x, u.size.y), 1.0);\n  let rad = max(u.radius, 0.05);\n  let t = u.time * u.speed;\n  let contourRad = rad * glsContourScale(uv, t, u.contourDeform);\n  if (length(uv) > contourRad * (1.01 + mfEdgeD(u.edgeSoftness))) {\n    let halo = clamp(mfEdgeGlow(vec3<f32>(0.0), uv, vec2<f32>(0.0), contourRad,\n                                u.edgeSoftness, u.edgeGlow, u.glowColor.rgb),\n                     vec3<f32>(0.0), vec3<f32>(1.0));\n    let haloAlpha = max(halo.r, max(halo.g, halo.b));\n    return vec4<f32>(halo, haloAlpha);\n  }\n  let p   = uv / contourRad;     \n  let pd  = length(p);\n  let ballA = 1.0 - smoothstep(0.99 - mfEdgeD(u.edgeSoftness), 1.01 + mfEdgeD(u.edgeSoftness), pd);\n  let clearFa = ballA;\n  let normal = glsContourNormal(uv, rad, t, u.contourDeform);\n  let edgeDepth = max(1.0 - pd, 0.0);\n  let refractionWidth = 0.015 + 0.95 * clamp(u.shellMidAlpha, 0.0, 1.0);\n  let refractionT = edgeDepth / max(refractionWidth, 0.001);\n  let refractionProfile = pow(glsRefractionProfile(refractionT), 0.68);\n  let refractionAmount = 1.6 * clamp(u.glassOpacity, 0.0, 1.0)\n                         * refractionProfile;\n  let refractedP = p - normal * refractionAmount;\n  var fcol = vec3<f32>(0.0);\n  if (clearFa > 0.0) {\n    if (u.glassEnabled > 0.5) {\n      let channelSplit = 0.14 * clamp(u.gloss, 0.0, 2.0)\n                         * clamp(u.glassOpacity, 0.0, 1.0) * refractionProfile;\n      let redSample = glsOpalFluid(refractedP - normal * channelSplit, t);\n      let greenSample = glsOpalFluid(refractedP, t);\n      let blueSample = glsOpalFluid(refractedP + normal * channelSplit, t);\n      fcol = vec3<f32>(redSample.r, greenSample.g, blueSample.b);\n    } else { fcol = glsOpalFluid(p, t); }\n  }\n  var col = clamp(fcol, vec3<f32>(0.0), vec3<f32>(1.0));\n  if (u.glassEnabled > 0.5) {\n    let surfaceWidth = 0.026 + 0.055 * clamp(u.shellEdgeAlpha, 0.0, 1.0);\n    let surfaceBand = (1.0 - smoothstep(0.0, surfaceWidth, edgeDepth)) * clearFa;\n    let opticalRim = pow(surfaceBand, 1.8);\n    let innerRimAlpha = opticalRim * u.glassOpacity * 0.45;\n    col = glsOver(col, u.shellInner.rgb, innerRimAlpha);\n    let coolDirection = normalize(vec2<f32>(0.84, 0.54));\n    let warmDirection = normalize(vec2<f32>(-0.62, -0.78));\n    let coolSplit = glsHighlightLobe(normal, coolDirection, -0.32, 1.8);\n    let warmSplit = glsHighlightLobe(normal, warmDirection, -0.28, 2.0);\n    let dispersion = opticalRim * clamp(u.gloss, 0.0, 2.0)\n                     * (0.8 + 0.8 * u.shellEdgeAlpha);\n    col = glsOver(col, u.shellMid.rgb, dispersion * coolSplit);\n    col = glsOver(col, u.shellEdge.rgb, dispersion * warmSplit);\n    let edgeShadow = opticalRim * (0.015 + 0.15 * u.shellEdgeAlpha)\n                     * (0.15 + 0.85 * max(dot(normal, vec2<f32>(0.45, -0.89)), 0.0));\n    col = col * (1.0 - edgeShadow);\n    let keyDirection = normalize(vec2<f32>(-0.68, 0.73));\n    let fillDirection = normalize(vec2<f32>(0.74, -0.67));\n    let key = opticalRim * glsHighlightLobe(normal, keyDirection, 0.2, 2.8)\n              * clamp(u.sheen, 0.0, 2.0) * 1.4;\n    let fill = opticalRim * glsHighlightLobe(normal, fillDirection, 0.4, 3.6)\n               * clamp(u.sheen, 0.0, 2.0) * 1.0;\n    col = glsOver(col, u.sheenColor.rgb, key);\n    col = glsOver(col, u.specColor.rgb, fill);\n  }\n  col = clamp(col * max(u.exposure, 0.0), vec3<f32>(0.0), vec3<f32>(1.0)) * ballA;\n  let edged = mfEdgeGlow(col, uv, vec2<f32>(0.0), contourRad,\n                         u.edgeSoftness, u.edgeGlow, u.glowColor.rgb);\n  let finalColor = clamp(edged, vec3<f32>(0.0), vec3<f32>(1.0));\n  let emissionAlpha = max(finalColor.r, max(finalColor.g, finalColor.b));\n  let sphereAlpha = clamp(max(ballA, emissionAlpha), 0.0, 1.0);\n  let finalAlpha = sphereAlpha;\n  return vec4<f32>(finalColor, finalAlpha);\n}\n\n@vertex\nfn vs_main(@builtin(vertex_index) i: u32) -> VOut {\n  var p = array<vec2<f32>, 3>(\n    vec2<f32>(-1.0, -1.0),\n    vec2<f32>( 3.0, -1.0),\n    vec2<f32>(-1.0,  3.0),\n  );\n  var out: VOut;\n  out.pos = vec4<f32>(p[i], 0.0, 1.0);\n  let uv01 = (p[i] + vec2<f32>(1.0)) * 0.5;\n  out.uv = vec2<f32>(uv01.x, 1.0 - uv01.y);\n  return out;\n}\n\n@fragment\nfn fs_main(in: VOut) -> @location(0) vec4<f32> {\n  let c = orbGlassLiquidAnim(in.uv);\n  let fc = vec2<f32>(in.uv.x, 1.0 - in.uv.y) * u.size;\n  let uv = (2.0 * fc - u.size) / max(min(u.size.x, u.size.y), 1.0);\n  let rad = max(u.radius, 0.05);\n  let t = u.time * u.speed;\n  let contourRad = rad * glsContourScale(uv, t, u.contourDeform);\n  let q = (2.0 * fc - u.size) / u.size;\n  let fitEnd = 1.0;\n  let fitFeather = 2.0 / max(min(u.size.x, u.size.y), 1.0);\n  let fitStart = min(mix(contourRad, fitEnd, 0.5), fitEnd - fitFeather);\n  let fit = 1.0 - smoothstep(fitStart, fitEnd, max(abs(q.x), abs(q.y)));\n  return vec4<f32>(c.rgb * fit, c.a * fit);\n}\n";
    // HEX → shader RGBA (0–1). Optional second argument overrides opacity.
    // colorA/B are the base gradient; paletteStop0–7 are layered color spots.
    function hexToRgba(hex, alpha) {
      if (alpha !== undefined && (!Number.isFinite(alpha) || alpha < 0 || alpha > 1)) {
        throw new RangeError("Alpha must be between 0 and 1");
      }
      if (typeof hex !== "string") throw new TypeError("Expected a HEX color string");
      let value = hex.trim().replace(/^#/, "");
      if (!/^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
        throw new Error("Invalid HEX color: " + hex);
      }
      if (value.length <= 4) value = [...value].map((digit) => digit + digit).join("");
      if (value.length === 6) value += "ff";
      return [0, 2, 4, 6].map((offset) =>
        offset === 6 && alpha !== undefined ? alpha : parseInt(value.slice(offset, offset + 2), 16) / 255);
    }

    const stateSeeds = {
      idle: [
        1, 1, // size [0–1]
        0, // time [2]
        5, // speed [3]
        0.7200000286102295, // radius [4]
        0.28200000524520874, // zoom [5]
        1.4559999704360962, // warp [6]
        0.1728000044822693, // ridgeAmt [7]
        2, // sharp [8]
        0, // shade [9]
        0.05, // sheen [10]
        0.05, // gloss [11]
        0.20000000298023224, // shellMidAlpha [12]
        0.03, // shellEdgeAlpha [13]
        0.8, // exposure [14]
        13, // style [15]
        0.12, // edgeSoftness [16]
        0, // edgeGlow [17]
        0, // paletteCount [18]
        1, // glassEnabled [19]
        0.1, // glassOpacity [20]
        0, // contourDeform [21]
        2, // bandDensity [22]
        0.41999998688697815, // chromaticShift [23]
        0.7699999809265137, // metalScale [24]
        0.23000000417232513, // metalStretch [25]
        65, // metalAngle [26]
        0, // metalOffset [27]
        0, // metalPhase [28]
        1, // metalEvolution [29]
        0.2199999988079071, // metalRoughness [30]
        0.25, // metalDepth [31]
        0.7200000286102295, // particleDensity [32]
        5, // ribbonCount [33]
        0.41999998688697815, // ribbonWidth [34]
        1.25, // ribbonTwist [35]
        0.550000011920929, // ribbonFold [36]
        0.30000001192092896, // ribbonBreath [37]
        1.2000000476837158, // particleSize [38]
        0.699999988079071, // particleBloom [39]
        ...hexToRgba("#E6D6CB"), // colorA [40–43]
        ...hexToRgba("#D8CDE6"), // colorB [44–47]
        ...hexToRgba("#ffb1a4"), // colorC [48–51]
        ...hexToRgba("#b7a9e5"), // colorD [52–55]
        ...hexToRgba("#E1DCD5"), // highlightColor [56–59]
        ...hexToRgba("#FFFFFF"), // shellInner [60–63]
        ...hexToRgba("#CDE5FF"), // shellMid [64–67]
        ...hexToRgba("#D9C8FF"), // shellEdge [68–71]
        ...hexToRgba("#EAF4FF"), // sheenColor [72–75]
        ...hexToRgba("#DCEAFF"), // specColor [76–79]
        ...hexToRgba("#07080D"), // canvasColor [80–83]
        ...hexToRgba("#82799B"), // glowColor [84–87]
        ...hexToRgba("#D9B5A0", 0.9), // paletteStop0 [88–91]
        ...hexToRgba("#CDB97C", 0.6), // paletteStop1 [92–95]
        ...hexToRgba("#B9AEDC", 0.75), // paletteStop2 [96–99]
        ...hexToRgba("#5E6080", 0.65), // paletteStop3 [100–103]
        ...hexToRgba("#C8305A", 0.6), // paletteStop4 [104–107]
        ...hexToRgba("#CDB97C", 0.5), // paletteStop5 [108–111]
        ...hexToRgba("#5E6080", 0.4), // paletteStop6 [112–115]
        ...hexToRgba("#B9AEDC", 0.6), // paletteStop7 [116–119]
        ...hexToRgba("#6F9EE8"), // paletteStop8 [120–123]
        ...hexToRgba("#6F9EE8"), // paletteStop9 [124–127]
        ...hexToRgba("#6F9EE8"), // paletteStop10 [128–131]
        ...hexToRgba("#6F9EE8"), // paletteStop11 [132–135]
      ],
      thinking: [
        1, 1, // size [0–1]
        0, // time [2]
        1.5, // speed [3]
        0.7200000286102295, // radius [4]
        0.30000001192092896, // zoom [5]
        2.799999952316284, // warp [6]
        0.36000001430511475, // ridgeAmt [7]
        2, // sharp [8]
        0, // shade [9]
        0.05, // sheen [10]
        0.05, // gloss [11]
        0.20000000298023224, // shellMidAlpha [12]
        0.03, // shellEdgeAlpha [13]
        0.8, // exposure [14]
        13, // style [15]
        0.12, // edgeSoftness [16]
        0, // edgeGlow [17]
        0, // paletteCount [18]
        1, // glassEnabled [19]
        0.1, // glassOpacity [20]
        0, // contourDeform [21]
        2, // bandDensity [22]
        0.41999998688697815, // chromaticShift [23]
        0.7699999809265137, // metalScale [24]
        0.23000000417232513, // metalStretch [25]
        65, // metalAngle [26]
        0, // metalOffset [27]
        0, // metalPhase [28]
        1, // metalEvolution [29]
        0.2199999988079071, // metalRoughness [30]
        0.25, // metalDepth [31]
        0.7200000286102295, // particleDensity [32]
        5, // ribbonCount [33]
        0.41999998688697815, // ribbonWidth [34]
        1.25, // ribbonTwist [35]
        0.550000011920929, // ribbonFold [36]
        0.30000001192092896, // ribbonBreath [37]
        1.2000000476837158, // particleSize [38]
        0.699999988079071, // particleBloom [39]
        ...hexToRgba("#E6D6CB"), // colorA [40–43]
        ...hexToRgba("#D8CDE6"), // colorB [44–47]
        ...hexToRgba("#D9B5A0"), // colorC [48–51]
        ...hexToRgba("#c5caff"), // colorD [52–55]
        ...hexToRgba("#FFFFFF"), // highlightColor [56–59]
        ...hexToRgba("#FFFFFF"), // shellInner [60–63]
        ...hexToRgba("#CDE5FF"), // shellMid [64–67]
        ...hexToRgba("#D9C8FF"), // shellEdge [68–71]
        ...hexToRgba("#EAF4FF"), // sheenColor [72–75]
        ...hexToRgba("#DCEAFF"), // specColor [76–79]
        ...hexToRgba("#07080D"), // canvasColor [80–83]
        ...hexToRgba("#9E8CFF"), // glowColor [84–87]
        ...hexToRgba("#D9B5A0", 0.9), // paletteStop0 [88–91]
        ...hexToRgba("#CDB97C", 0.6), // paletteStop1 [92–95]
        ...hexToRgba("#B9AEDC", 0.75), // paletteStop2 [96–99]
        ...hexToRgba("#5E6080", 0.65), // paletteStop3 [100–103]
        ...hexToRgba("#d74f75", 0.6), // paletteStop4 [104–107]
        ...hexToRgba("#CDB97C", 0.5), // paletteStop5 [108–111]
        ...hexToRgba("#5E6080", 0.4), // paletteStop6 [112–115]
        ...hexToRgba("#B9AEDC", 0.6), // paletteStop7 [116–119]
        ...hexToRgba("#6F9EE8"), // paletteStop8 [120–123]
        ...hexToRgba("#6F9EE8"), // paletteStop9 [124–127]
        ...hexToRgba("#6F9EE8"), // paletteStop10 [128–131]
        ...hexToRgba("#6F9EE8"), // paletteStop11 [132–135]
      ],
    };
    // Fixed Dusk palette, independent of the amount.
    const DUSK_PALETTE = {
      base: ["#ffffff", "#e7d4ff"],
      spots: [
        ["#ffbfb4", 0.9],
        ["#ffedb9", 0.6],
        ["#a595da", 0.75],
        ["#527c5f", 0.6],
        ["#C8305A", 0.6],
        ["#CDB97C", 0.5],
        ["#5E6080", 0.4],
      ],
    };
    const duskBase = new Float32Array(DUSK_PALETTE.base.flatMap((hex) => hexToRgba(hex)));
    // Always upload all eight slots so removed spots cannot retain seed colors.
    const duskSpots = new Float32Array(32);
    DUSK_PALETTE.spots.slice(0, 8).forEach(([hex, alpha], index) => {
      duskSpots.set(hexToRgba(hex, alpha), index * 4);
    });
    let IDLE_BRIGHTNESS = 2; // Idle is 25% brighter; saturation stays constant.
    let DRAG_BRIGHTNESS = 1.2;

    const activationDurationMs = 220;
    const settleDurationMs = 650;
    const canvas = document.querySelector('[data-dw="orb"]');
    if (!canvas) return;
    const card = canvas.closest('.dw');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrame = 0;
    let device = null;
    let stopped = false;
    let state = "idle"; // Initial appearance uses the idle HEX colors above.
    let transitionTargetState = state;
    let fromUniforms = new Float32Array(stateSeeds[state]);
    let targetUniforms = new Float32Array(stateSeeds[state]);
    const displayedUniforms = new Float32Array(stateSeeds[state]);
    let transitionStartedAt = 0;
    let activeTransitionDuration = 0;
    let lastFrameAt = null;
    let motionPhase = 0;
    let sliderDragging = false;
    let dragSpeed = 1;
    let interactionBrightness = IDLE_BRIGHTNESS;
    let detail = 1.2;
    const controls = document.querySelector('[data-dw-controls]');
    function addControl(group, text, type, initial, update, options = {}) {
      const row = document.createElement('div');
      const label = document.createElement('label');
      label.append(text + ' ');
      const input = document.createElement('input');
      input.type = type;
      Object.assign(input, options);
      input.value = initial;
      const output = document.createElement('output');
      output.value = initial;
      input.addEventListener('input', () => {
        output.value = input.value;
        update(type === 'range' ? Number(input.value) : input.value);
      });
      label.append(input, ' ', output);
      row.append(label);
      group.append(row);
    }
    if (controls) {
      const palette = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'Shader colors';
      palette.append(legend);
      DUSK_PALETTE.base.forEach((hex, index) => {
        addControl(palette, `Base ${index + 1}`, 'color', hex, value => duskBase.set(hexToRgba(value), index * 4));
      });
      DUSK_PALETTE.spots.forEach(([hex, alpha], index) => {
        addControl(palette, `Spot ${index + 1}`, 'color', hex, value => duskSpots.set(hexToRgba(value, alpha), index * 4));
      });
      controls.append(palette);
      addControl(controls, 'Fragmentation (patch density)', 'range', detail, value => { detail = value; }, { min: 0.1, max: 8, step: 0.1 });
      addControl(controls, 'Idle / released opacity', 'range', 0.5, value => card.style.setProperty('--orb-idle-opacity', value), { min: 0, max: 1, step: 0.01 });
      addControl(controls, 'Dragging opacity', 'range', 1, value => card.style.setProperty('--orb-drag-opacity', value), { min: 0, max: 1, step: 0.01 });
      addControl(controls, 'Idle / released brightness', 'range', IDLE_BRIGHTNESS, value => { IDLE_BRIGHTNESS = value; }, { min: 0, max: 4, step: 0.05 });
      addControl(controls, 'Dragging brightness', 'range', DRAG_BRIGHTNESS, value => { DRAG_BRIGHTNESS = value; }, { min: 0, max: 4, step: 0.05 });
    }
    card?.addEventListener("dw-drag-change", (event) => {
      sliderDragging = event.detail.dragging;
      card?.classList.toggle("is-orb-dragging", sliderDragging);
    });
    window.addEventListener("blur", () => {
      sliderDragging = false;
      card?.classList.remove("is-orb-dragging");
    });
    const audioRules = [[3,"all",0,0.7,5],[6,"mid",0.85,0,7],[21,"low",0.075,0,1],[10,"high",0.16,0,2],[14,"all",0,0.12,4]];
    const audioFlowStrengths = {"9":0.8,"10":0.65,"11":0.65,"14":0.75,"19":1,"21":0.7};
    function applyAudioUniforms(values, bands) {
      const strength = audioFlowStrengths[Math.round(values[15])] ?? 0;
      if (!strength) return;
      for (const [index, band, additive, proportional, ceiling] of audioRules) {
        const input = bands[band];
        const level = (Number.isFinite(input) ? Math.max(0, Math.min(1, input)) : 0) * strength;
        if (!level) continue;
        values[index] = Math.min(Math.max(ceiling, values[index]), values[index] * (1 + proportional * level) + additive * level);
      }
    }
    let audioBands = { low: 0, mid: 0, high: 0, all: 0 };
    // Feed normalized 0...1 bands from your audio analyser; zero them on stop.
    function setAudioBands(bands = {}) {
      audioBands = Object.fromEntries(["low", "mid", "high", "all"].map(key => [key,
        Number.isFinite(bands[key]) ? Math.max(0, Math.min(1, bands[key])) : 0]));
    }

    function srgbToLinear(value) {
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    }

    function linearToSrgb(value) {
      return value <= 0.0031308
        ? value * 12.92
        : 1.055 * value ** (1 / 2.4) - 0.055;
    }

    function mixSrgb(from, to, progress) {
      return linearToSrgb(
        srgbToLinear(from) + (srgbToLinear(to) - srgbToLinear(from)) * progress,
      );
    }

    function transitionProgress(now) {
      if (activeTransitionDuration === 0) return 1;
      const raw = Math.min(1, Math.max(0, (now - transitionStartedAt) / activeTransitionDuration));
      return transitionTargetState === "thinking"
        ? 1 - (1 - raw) ** 3
        : raw * raw * (3 - 2 * raw);
    }

    function sampleTransition(now) {
      const progress = transitionProgress(now);
      for (let index = 3; index < displayedUniforms.length; index += 1) {
        const colorComponent = index >= 40
          && (index - 40) % 4 < 3;
        displayedUniforms[index] = colorComponent
          ? mixSrgb(fromUniforms[index], targetUniforms[index], progress)
          : fromUniforms[index] + (targetUniforms[index] - fromUniforms[index]) * progress;
      }
      return displayedUniforms;
    }

    function setState(nextState) {
      if (!Object.prototype.hasOwnProperty.call(stateSeeds, nextState)) {
        throw new TypeError(`Unknown liquid orb state: ${nextState}`);
      }
      if (nextState === state) return;

      const now = performance.now();
      sampleTransition(now);
      fromUniforms = new Float32Array(displayedUniforms);
      targetUniforms = new Float32Array(stateSeeds[nextState]);
      transitionTargetState = nextState;
      transitionStartedAt = now;
      activeTransitionDuration = nextState === "thinking"
        ? activationDurationMs
        : settleDurationMs;
      state = nextState;
    }

    Object.defineProperty(window, "liquidOrb", {
      value: Object.freeze({
        getState: () => state,
        setState,
        setAudioBands,
      }),
    });

    // Fall back to the SVG glow: hide the canvas and leave the card as it was.
    function stopWithError(error) {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(animationFrame);
      device?.destroy();
      card?.classList.remove("has-orb");
      console.warn("Liquid orb disabled:", error instanceof Error ? error.message : error);
    }

    async function start() {
      if (!navigator.gpu) throw new Error("WebGPU is not supported in this environment.");
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("No compatible WebGPU adapter was found.");
      device = await adapter.requestDevice();
      const context = canvas.getContext("webgpu");
      if (!context) throw new Error("Unable to create a WebGPU canvas context.");

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: "premultiplied" });
      const blend = Math.max(0, Math.min(1, COLOR_BLEND));
      const shader = device.createShaderModule({ code: shaderSource.replace(
        "const DW_COLOR_BLEND: f32 = 0.2;",
        `const DW_COLOR_BLEND: f32 = ${blend.toFixed(4)};`,
      ) });
      const compilation = await shader.getCompilationInfo();
      const errors = compilation.messages.filter((message) => message.type === "error");
      if (errors.length) {
        throw new Error(errors.map((message) => `${message.lineNum}:${message.linePos} ${message.message}`).join("\n"));
      }

      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: shader, entryPoint: "vs_main" },
        fragment: {
          module: shader,
          entryPoint: "fs_main",
          targets: [{
            format,
            blend: {
              color: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          }],
        },
        primitive: { topology: "triangle-list" },
      });
      const values = new Float32Array(displayedUniforms);
      const uniformBuffer = device.createBuffer({
        size: values.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });
      device.lost.then((info) => {
        stopWithError(new Error(`WebGPU device lost: ${info.message || info.reason}`));
      });
      device.addEventListener("uncapturederror", (event) => {
        event.preventDefault();
        stopWithError(new Error(`WebGPU rendering error: ${event.error.message}`));
      });

      function frame(now) {
        if (stopped) return;
        try {
          const dpr = Math.min(window.devicePixelRatio || 1, 1);
          const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
          const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          values.set(sampleTransition(now));
          const frameDelta = lastFrameAt === null || reduceMotion
            ? 0
            : Math.min(0.1, Math.max(0, (now - lastFrameAt) / 1000));
          lastFrameAt = now;
          values.set(duskBase, 40);
          values.set(duskSpots, 88);
          values[22] = detail;
          const brightnessTarget = sliderDragging ? DRAG_BRIGHTNESS : IDLE_BRIGHTNESS;
          const brightnessEase = reduceMotion ? 1 : 1 - Math.exp(-frameDelta / (sliderDragging ? 0.16 : 0.55));
          interactionBrightness += (brightnessTarget - interactionBrightness) * brightnessEase;
          values[14] *= interactionBrightness; // Adjust exposure only; retain saturation and spot contrast.
          applyAudioUniforms(values, audioBands);
          const targetDragSpeed = sliderDragging ? DRAG_SPEED_MULTIPLIER : 1;
          const speedEase = 1 - Math.exp(-frameDelta / (sliderDragging ? 0.12 : 0.35));
          dragSpeed += (targetDragSpeed - dragSpeed) * speedEase;
          motionPhase += frameDelta * Math.max(values[3], 0) * dragSpeed;
          values[0] = width;
          values[1] = height;
          values[2] = motionPhase / Math.max(values[3], 0.001);
          device.queue.writeBuffer(uniformBuffer, 0, values);

          const encoder = device.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            colorAttachments: [{
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: "clear",
              storeOp: "store",
            }],
          });
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(3);
          pass.end();
          device.queue.submit([encoder.finish()]);
          // Swap the SVG glow for the orb once the first frame is on screen
          card?.classList.add("has-orb");
          animationFrame = requestAnimationFrame(frame);
        } catch (error) {
          stopWithError(error);
        }
      }

      animationFrame = requestAnimationFrame(frame);
    }

    window.addEventListener("pagehide", () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      device?.destroy();
    }, { once: true });
    start().catch((error) => {
      stopWithError(error);
    });
})();
