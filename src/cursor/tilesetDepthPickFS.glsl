uniform sampler2D u_tilesetDepth;

in vec2 v_textureCoordinates;

void main()
{
    float depth = texelFetch(u_tilesetDepth, ivec2(gl_FragCoord.xy), 0).r;
    out_FragColor = czm_packDepth(depth);
}
