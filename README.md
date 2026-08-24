# bomba

Interfaz web para el puzzle box de cumpleaños.

- `index.html`: interfaz que se ve en el celular integrado en la lonchera.
- `simulator.html`: simulador de los controles físicos (palancas, cables, botón rojo y botón final `DESATIBAR BONBA`).

Para probarlo, abrir ambas páginas desde el mismo sitio/origen en dos pestañas. Se sincronizan mediante `localStorage`.

## Estado actual

Incluye:
- espera con PIP y llamada al escuadrón;
- placeholder negro para el video con subtítulos;
- fallo inicial;
- módulo de palancas/cables;
- módulo de 16 símbolos;
- módulo Morse con representación del candado físico de 5 cifras;
- espera tras abrir la caja;
- final disparado por el botón físico `DESATIBAR BONBA`;
- modo operador oculto tocando 5 veces la esquina superior derecha.

La condición de éxito del módulo de palancas/cables es provisoria hasta definir la lógica real del manual y las posiciones físicas.