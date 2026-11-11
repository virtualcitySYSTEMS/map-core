uniform sampler2D u_tilesetDepth;

uniform sampler2D colorTexture;
uniform sampler2D depthTexture;

uniform vec2  u_cursorCenter;
uniform vec4  u_cursorColor;

uniform float u_cursorRadius;
uniform float u_maxCursorDistance;

in vec2 v_textureCoordinates;

#define MIN_TEXTURE_DISTANCE 0.15

/**
 * Fetches the texel value from the intensity or depth texture.
 * @param {sampler2D} source - The texture to sample from (intensity or depth).
 * @param {vec2} scaled_st - Scaled texture coordinates.
 * @returns {float} - The sampled value.
 */
float get_texel_value(sampler2D source,  vec2 scaled_uv, ivec2 texSize)
{
    ivec2 pixelCoord = ivec2(scaled_uv * vec2(texSize));
    vec4 texel_value = texelFetch(source, pixelCoord, 0);

    float sample_value = 0.0;
    sample_value = texel_value.r;

    return sample_value;
}

vec3 toEyeSpace(vec2 uv, float rawDepth) {
    float windowZ = rawDepth;
    vec2  ndcXY   = uv * 2.0 - 1.0;
    float ndcZ    = windowZ * 2.0 - 1.0;
    vec4  clipPos = vec4(ndcXY, ndcZ, 1.0);
    vec4  eyePos  = czm_inverseProjection * clipPos;
    return eyePos.xyz / eyePos.w;
}

void main()
{
    vec4 color = texture(colorTexture, v_textureCoordinates);

    if (u_cursorColor.a == 0.0 || u_cursorRadius == 0.0)
    {
        out_FragColor = color;
        return;
    }

    float in_range = distance(u_cursorCenter, v_textureCoordinates);
    if (in_range > MIN_TEXTURE_DISTANCE)
    {
        out_FragColor = color;
        return;
    }

    ivec2 texSize = textureSize(u_tilesetDepth, 0);

    float centerRawDepth = get_texel_value(u_tilesetDepth, u_cursorCenter, texSize);

    if (centerRawDepth == 1.0)
    {
        out_FragColor = color;
        return;
    }

    float fragRawDepth   = get_texel_value(u_tilesetDepth, v_textureCoordinates, texSize);

    vec3 centerEye = toEyeSpace(u_cursorCenter, centerRawDepth);
    vec3 fragEye   = toEyeSpace(v_textureCoordinates, fragRawDepth);

    if (length(centerEye) > u_maxCursorDistance)
    {
        out_FragColor = color;
        return;
    }

    float r = u_cursorRadius;
    float dist = distance(fragEye, centerEye);

    bool inCursor =
        dist < r * 0.111 ||
        (dist > r * 0.333 && dist < r * 0.555) ||
        (dist > r * 0.777 && dist < r);

      if (inCursor && fragRawDepth != 1.0)
    {
        color.rgb = mix(color.rgb, u_cursorColor.rgb, u_cursorColor.a);
    }

    out_FragColor = color;
}

