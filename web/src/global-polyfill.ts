// SockJS (and some Node-oriented deps) expect `global` in the browser.
(window as unknown as { global: Window }).global = window;
