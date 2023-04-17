/**
 * Symbol to identify a {@see Vertex}
 * @type {symbol}
 */
export const vertexSymbol = Symbol('Vertex');
/**
 * Symbol to denote the vertexes index in the vertices array. This is important for snapping & bbox operations
 * @type {symbol}
 */
export const vertexIndex = Symbol('VertexIndex');
/**
 * Symbol added to primitives and features to denote that these are handlers. It is expected, that the value of the symobl is
 * equal to an {@see AXIS_AND_PLANES}
 * @type {symbol}
 */
export const handlerSymbol = Symbol('Handler');
/**
 * Symbol to identify which was the last editor mouse over handler that edited the cursor style.
 * @type {symbol}
 */
export const mouseOverSymbol = Symbol('MouseOver');
