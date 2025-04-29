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
 * @uniform {sampler2D} image - RGB panorama texture
 * @uniform {sampler2D} intensity - Intensity data texture
 * @uniform {sampler2D} depth - Depth data texture (16-bit encoded in RG channels)
 * @uniform {sampler2D} debug - Debug visualization texture
 * @uniform {vec3} cursorPosition - 3D cursor position for interaction
 * @uniform {vec2} minSt, maxSt - Texture coordinate bounds
 * @uniform {float} opacity - Overall opacity of the material
 * @uniform {bool} showIntensity - Whether to show intensity data instead of RGB
 * @uniform {bool} showDebug - Whether to show debug overlay
 * @uniform {bool} depthReady - Flag indicating if depth data is ready
 */

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
 * Fetches the texel value from the intensity or depth texture based on the specified algorithm.
 * @param {sampler2D} source - The texture to sample from (intensity or depth).
 * @param {vec2} scaled_st - Scaled texture coordinates.
 * @param {int} algorithm - Algorithm type (1 for depth, 2 for intensity).
 * @returns {float} - The sampled value.
 */
float get_texel_value(sampler2D source, vec2 scaled_st, int algorithm)
{
    ivec2 texSize = textureSize(source, 0);
    ivec2 pixelCoord = ivec2(scaled_st * vec2(texSize));

    vec4 texel_value = texelFetch(source, pixelCoord, 0);

    float sample_value = 0.0;
    sample_value = texel_value.r;

    return sample_value;
}

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material m = czm_getDefaultMaterial(materialInput);
    vec2 clamped = clamp(materialInput.st, minSt, maxSt);
    vec2 scaled = (clamped - minSt) / (maxSt - minSt);
    vec4 t_color = texture(image, scaled);
    if (showIntensity && !showDepth)
    {
        float inensity_value = get_texel_value(intensity, scaled, 2);
        vec4 intensity_color;
        if (inensity_value > 0.0)
        {
            intensity_color = vec4(inensity_value, inensity_value, inensity_value, 1.0);
        }
        else
        {
            intensity_color = vec4(1.0, 0.0, 0.0, 1.0);
        }
        t_color = mix(t_color, intensity_color, intensityOpacity);
    }

    bool has_position = cursorPosition != vec3(-1.0, -1.0, -1.0);
    if (depthReady && (showDepth || has_position))
    {
        float avg_depth = get_texel_value(depth, scaled, 1);
        if (showDepth)
        {
            vec4 depth_color;
            if (avg_depth > 0.0)
            {
                depth_color = vec4(avg_depth, avg_depth, avg_depth, 1.0);
            }
            else
            {
                depth_color = vec4(1.0, 0.0, 0.0, 1.0);
            }
            t_color = mix(t_color, depth_color, intensityOpacity);
        }

        if (has_position && avg_depth > 0.0)
        {
            vec3 fragment_position = getCartesian(materialInput.st.x, materialInput.st.y);
            fragment_position *= avg_depth;
            float dist_to_cursor = distance(fragment_position, cursorPosition);

            if (dist_to_cursor < cursorRadius)
            {
                bool in_ring = false;
                if (cursorRings == 0.0) {
                    in_ring = true;
                } else {
                    float ring_spacing = cursorRadius / (cursorRings * 2.0);

                    // Check if we're in any ring
                    for (int i = 0; i < int(cursorRings); i++) {
                        float outer = cursorRadius - (float(i) * 2.0 * ring_spacing);
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

    if (showDebug)
    {
        vec4 debug = texture(debug, scaled);
        if (debug.a > 0.0)
        {
            t_color = vec4(debug.r, debug.g, debug.b, 1.0);
        }
    }

    m.diffuse = t_color.rgb;
    m.specular = 0.5;
    m.emission = t_color.rgb * vec3(0.5);
    m.alpha = opacity;
    return m;
}