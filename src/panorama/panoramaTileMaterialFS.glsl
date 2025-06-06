/**
 * Fragment shader for panorama tile rendering
 *
 * This shader handles rendering of panorama tiles with support for:
 * - RGB image display
 * - Intensity data visualization
 * - Depth information processing
 * - Debug mode overlays
 * - Interactive cursor highlighting
 *
 * @uniform {sampler2D} u_rgb - RGB panorama texture
 * @uniform {sampler2D} u_intensity - Intensity data texture
 * @uniform {sampler2D} u_depth - Depth data texture (16-bit encoded in RG channels)
 * @uniform {sampler2D} u_debug - Debug visualization texture
 * @uniform {vec3} u_cursorPosition - 3D cursor position for interaction
 * @uniform {vec2} u_minUV, u_maxSt - Texture coordinate bounds
 * @unifrom {vec3} u_maxUV - Texture coordinate bounds
 * @uniform {float} u_opacity - Overall opacity of the material
 * @uniform {float} u_overlayIntensity - Overlay intensity (for both modes)
 * @uniform {int} u_overlay - Overlay mode (0 = intensity, 1 = depth)
 * @uniform {bool} u_imageReady - Flag indicating if image data is ready
 * @uniform {bool} u_intensityReady - Flag indicating if intensity data is ready
 * @uniform {bool} u_depthReady - Flag indicating if depth data is ready
 * @uniform {float} u_cursorRadius - Radius of the interactive cursor
 * @uniform {float} u_cursorRings - Number of rings in the interactive cursor
 * @uniform {vec4} u_overlayNaNColor - Color used for missing/NaN overlay values
 */

#define OVERLAY_INTENSITY 1.0
#define OVERLAY_DEPTH 2.0

/**
 * Converts spherical texture coordinates (x, y) to Cartesian coordinates. see spherical coordinates for more details on the coordinate system.
 * @param {float} st_x - spherical texture coordinates .
 * @param {float} st_y - spherical texture coordinates y.
 * @returns {vec3} - Cartesian coordinates
 */
vec3 getCartesian(float st_x, float st_y)
{
    float phi = st_x * 2.0 * 3.14159265359;
    // texture coordinates are flipped in y axis
    float theta = 3.14159265359 - st_y * 3.14159265359;
    return vec3(
        sin(theta) * cos(phi),
        sin(theta) * sin(phi),
        cos(theta)
    );
}

/**
 * Fetches the texel value from the intensity or depth texture.
 * @param {sampler2D} source - The texture to sample from (intensity or depth).
 * @param {vec2} scaled_st - Scaled texture coordinates.
 * @returns {float} - The sampled value.
 */
float get_texel_value(sampler2D source, vec2 scaled_uv)
{
    ivec2 texSize = textureSize(source, 0);
    ivec2 pixelCoord = ivec2(scaled_uv * vec2(texSize));

    vec4 texel_value = texelFetch(source, pixelCoord, 0);

    float sample_value = 0.0;
    sample_value = texel_value.r;

    return sample_value;
}

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material m = czm_getDefaultMaterial(materialInput);
    if (!u_imageReady) {
        m.alpha = 0.0;
        return m;
    }

    vec2 clamped_uv = clamp(materialInput.st, u_minUV, u_maxUV);
    vec2 scaled_uv = (clamped_uv - u_minUV) / (u_maxUV - u_minUV);

    vec4 t_color = texture(u_rgb, scaled_uv);
    if (u_intensityReady && u_overlay == OVERLAY_INTENSITY)
    {
        float inensity_value = get_texel_value(u_intensity, scaled_uv);
        vec4 intensity_color;
        if (inensity_value > 0.0)
        {
            intensity_color = vec4(inensity_value, inensity_value, inensity_value, 1.0);
        }
        else
        {
            intensity_color = u_overlayNaNColor;
        }
        t_color = mix(t_color, intensity_color, u_overlayOpacity);
    }

    bool has_position = u_cursorPosition != vec3(-1.0, -1.0, -1.0);
    bool show_depth = u_overlay == OVERLAY_DEPTH;
    if (u_depthReady && (show_depth || has_position))
    {
        float avg_depth = get_texel_value(u_depth, scaled_uv);
        if (show_depth)
        {
            vec4 depth_color;
            if (avg_depth > 0.0)
            {
                depth_color = vec4(avg_depth, avg_depth, avg_depth, 1.0);
            }
            else
            {
                depth_color = u_overlayNaNColor;
            }
            t_color = mix(t_color, depth_color, u_overlayOpacity);
        }

        if (has_position && avg_depth > 0.0)
        {
            vec3 fragment_position = getCartesian(materialInput.st.x, materialInput.st.y);
            fragment_position *= avg_depth;
            float dist_to_cursor = distance(fragment_position, u_cursorPosition);

            if (dist_to_cursor < u_cursorRadius)
            {
                bool in_ring = false;
                if (u_cursorRings == 0.0) {
                    in_ring = true;
                } else {
                    float ring_spacing = u_cursorRadius / (u_cursorRings * 2.0);

                    // Check if we're in any ring
                    for (int i = 0; i < int(u_cursorRings); i++) {
                        float outer = u_cursorRadius - (float(i) * 2.0 * ring_spacing);
                        float inner = outer - ring_spacing;

                        if (dist_to_cursor < outer && dist_to_cursor > inner) {
                            in_ring = true;
                            break;
                        }
                    }
                }
                
                // Apply coloring if in a ring or center dot
                if (in_ring) {
                    t_color = vec4(1.0, 0.8078, 0.0, 1.0); // VCS Yellow
                }
            }
        }
    }

    if (u_showDebug)
    {
        vec4 debug = texture(u_debug, scaled_uv);
        if (debug.a > 0.0)
        {
            t_color = vec4(debug.r, debug.g, debug.b, 1.0);
        }
    }

    m.diffuse = t_color.rgb;
    m.specular = 0.5;
    m.emission = t_color.rgb * vec3(0.5);
    m.alpha = u_opacity;
    return m;
}
