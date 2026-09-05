/* ============================================================
   Stack Lab — three interactive topologies sharing one engine.
   Pull a patch cable and everything downstream of the break
   loses link. Works with mouse, keyboard and touch, and lays
   itself out differently on narrow screens.
   ============================================================ */
(function () {
    'use strict';

    const svg = document.getElementById('net-svg');
    if (!svg) return;

    const NS = 'http://www.w3.org/2000/svg';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrowQuery = matchMedia('(max-width: 700px)');

    /* ── The three scenes ──────────────────────────────────── */
    const SCENES = {
        web: {
            tab: 'Web delivery',
            title: 'From design file to every breakpoint',
            chain: [
                { id: 'design', label: 'Design File', sub: 'Figma · art direction' },
                { id: 'platform', label: 'Build Platform', sub: 'Webflow · Framer · WordPress' },
                { id: 'edge', label: 'Edge / CDN', sub: 'Cloudflare · TLS · caching' }
            ],
            links: ['Design handoff', 'Deploy to edge'],
            linkColors: ['#a78bfa', '#f59e0b'],
            leaves: [
                { id: 'desktop', label: 'Desktop', sub: '1440px layout', color: '#22c55e', wire: 'Desktop breakpoint' },
                { id: 'tablet', label: 'Tablet', sub: '768px layout', color: '#cbd5e1', wire: 'Tablet breakpoint' },
                { id: 'mobile', label: 'Mobile', sub: '375px layout', color: '#38bdf8', wire: 'Mobile breakpoint' },
                { id: 'vitals', label: 'SEO + Vitals', sub: 'Metadata · Core Web Vitals', color: '#eab308', wire: 'Search + analytics' }
            ],
            note: 'A build is only finished when every breakpoint holds. Cut the handoff and nothing downstream gets made.'
        },
        automation: {
            tab: 'Automation',
            title: 'Work that runs without me',
            chain: [
                { id: 'form', label: 'Website Form', sub: 'Visitor submission' },
                { id: 'hook', label: 'Webhook', sub: 'HTTPS endpoint · self-hosted' },
                { id: 'n8n', label: 'n8n Workflow', sub: 'Branch · transform · retry' }
            ],
            links: ['Form submit', 'Trigger workflow'],
            linkColors: ['#38bdf8', '#a78bfa'],
            leaves: [
                { id: 'sheet', label: 'Google Sheets', sub: 'Row appended', color: '#22c55e', wire: 'Store the lead' },
                { id: 'telegram', label: 'Telegram', sub: 'Instant notification', color: '#38bdf8', wire: 'Notify me' },
                { id: 'mail', label: 'Auto-reply', sub: 'Acknowledgement sent', color: '#cbd5e1', wire: 'Answer the sender' },
                { id: 'uptime', label: 'Uptime Check', sub: 'Scheduled · alerts on fail', color: '#eab308', wire: 'Watch client sites' }
            ],
            note: 'Each branch is one less thing done by hand. Break the trigger and the whole chain goes quiet.'
        },
        network: {
            tab: 'Network',
            title: 'The rack it all runs on',
            chain: [
                { id: 'ont', label: 'Fiber ONT', sub: 'WAN uplink' },
                { id: 'fw', label: 'Firewall', sub: 'VLANs · DNS · WireGuard' },
                { id: 'sw', label: 'Core Switch', sub: '8-port managed' }
            ],
            links: ['ONT → Firewall WAN', 'Firewall LAN → Switch uplink'],
            linkColors: ['#3b82f6', '#f59e0b'],
            leaves: [
                { id: 'srv', label: 'Server', sub: 'Ubuntu · Docker · Nginx', color: '#22c55e', wire: 'Switch P1 → Server' },
                { id: 'ws', label: 'Workstation', sub: 'Dev machine', color: '#cbd5e1', wire: 'Switch P2 → Workstation' },
                { id: 'ap', label: 'Access Point', sub: 'Wi-Fi · IoT VLAN', color: '#38bdf8', wire: 'Switch P3 → Access Point' },
                { id: 'nas', label: 'NAS', sub: 'Snapshots · backups', color: '#eab308', wire: 'Switch P4 → NAS' }
            ],
            note: 'Pull the switch uplink and five devices drop at once — the same way it goes when a lead works loose.'
        }
    };

    const ORDER = ['web', 'automation', 'network'];
    const state = {};   // per-scene plug state, so switching tabs keeps your changes
    ORDER.forEach(k => { state[k] = {}; });

    let current = 'web';
    let narrow = narrowQuery.matches;
    let L = null;       // active layout

    /* ── Layout ────────────────────────────────────────────── */
    function layout(scene, isNarrow) {
        const devices = [], ports = {}, cables = [];
        const c = scene.chain;

        if (!isNarrow) {
            const box = [[40, 20, 200, 62], [40, 170, 200, 62], [40, 300, 240, 110]];
            c.forEach((n, i) => devices.push(Object.assign({}, n, {
                x: box[i][0], y: box[i][1], w: box[i][2], h: box[i][3]
            })));

            ports[c[0].id + '.out'] = { dev: c[0].id, x: 140, y: 82, dir: 'down' };
            ports[c[1].id + '.in'] = { dev: c[1].id, x: 140, y: 170, dir: 'up' };
            ports[c[1].id + '.out'] = { dev: c[1].id, x: 140, y: 232, dir: 'down' };
            ports[c[2].id + '.in'] = { dev: c[2].id, x: 140, y: 300, dir: 'up' };

            scene.leaves.forEach((leaf, i) => {
                devices.push(Object.assign({}, leaf, { x: 560, y: 18 + i * 100, w: 224, h: 62 }));
                ports[c[2].id + '.p' + i] = { dev: c[2].id, x: 280, y: 322 + i * 26, dir: 'right' };
                ports[leaf.id + '.in'] = { dev: leaf.id, x: 560, y: 49 + i * 100, dir: 'left' };
            });

            var viewBox = '0 0 820 420';
        } else {
            const box = [[20, 16, 320, 56], [20, 136, 320, 56], [20, 256, 320, 64]];
            c.forEach((n, i) => devices.push(Object.assign({}, n, {
                x: box[i][0], y: box[i][1], w: box[i][2], h: box[i][3]
            })));

            ports[c[0].id + '.out'] = { dev: c[0].id, x: 180, y: 72, dir: 'down' };
            ports[c[1].id + '.in'] = { dev: c[1].id, x: 180, y: 136, dir: 'up' };
            ports[c[1].id + '.out'] = { dev: c[1].id, x: 180, y: 192, dir: 'down' };
            ports[c[2].id + '.in'] = { dev: c[2].id, x: 180, y: 256, dir: 'up' };

            // Leaves stack down the right, cables bundled in the left gutter.
            scene.leaves.forEach((leaf, i) => {
                const y = 400 + i * 88;
                devices.push(Object.assign({}, leaf, { x: 150, y: y, w: 190, h: 56 }));
                ports[c[2].id + '.p' + i] = { dev: c[2].id, x: 40 + i * 20, y: 320, dir: 'down' };
                ports[leaf.id + '.in'] = { dev: leaf.id, x: 150, y: y + 28, dir: 'left' };
            });

            var viewBox = '0 0 360 736';
        }

        cables.push({ id: 'k0', a: c[0].id + '.out', b: c[1].id + '.in', color: scene.linkColors[0], label: scene.links[0] });
        cables.push({ id: 'k1', a: c[1].id + '.out', b: c[2].id + '.in', color: scene.linkColors[1], label: scene.links[1] });
        scene.leaves.forEach((leaf, i) => {
            cables.push({
                id: 'l' + i, a: c[2].id + '.p' + i, b: leaf.id + '.in',
                color: leaf.color, label: leaf.wire
            });
        });

        return { devices, ports, cables, viewBox, root: c[0].id };
    }

    /* ── Helpers ───────────────────────────────────────────── */
    function el(tag, attrs, parent) {
        const n = document.createElementNS(NS, tag);
        for (const k in attrs) n.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(n);
        return n;
    }

    function anchor(p) {
        const D = 20;
        if (p.dir === 'right') return { x: p.x + D, y: p.y };
        if (p.dir === 'left') return { x: p.x - D, y: p.y };
        if (p.dir === 'up') return { x: p.x, y: p.y - D };
        return { x: p.x, y: p.y + D };
    }

    function restPoint(c) {
        const a = anchor(L.ports[c.a]);
        const b = anchor(L.ports[c.b]);
        return { x: (a.x + b.x) / 2 + (narrow ? -14 : 30), y: Math.max(a.y, b.y) + (narrow ? 54 : 96) };
    }

    function reachable() {
        const plugged = state[current];
        const adj = {};
        L.devices.forEach(d => { adj[d.id] = []; });
        L.cables.forEach(c => {
            if (plugged[c.id] === false) return;
            const x = L.ports[c.a].dev, y = L.ports[c.b].dev;
            adj[x].push(y);
            adj[y].push(x);
        });
        const seen = new Set([L.root]);
        const queue = [L.root];
        while (queue.length) {
            const n = queue.shift();
            adj[n].forEach(m => { if (!seen.has(m)) { seen.add(m); queue.push(m); } });
        }
        return seen;
    }

    /* ── Build the scene ───────────────────────────────────── */
    let deviceEls = {}, cableEls = {};

    function build() {
        const scene = SCENES[current];
        L = layout(scene, narrow);
        svg.setAttribute('viewBox', L.viewBox);
        svg.innerHTML = '';
        deviceEls = {};
        cableEls = {};

        const defs = el('defs', {}, svg);
        const grad = el('linearGradient', { id: 'nl-chassis', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
        el('stop', { offset: '0', 'stop-color': '#2b3038' }, grad);
        el('stop', { offset: '1', 'stop-color': '#171a20' }, grad);

        const gJacks = el('g', {}, svg);
        const gDevices = el('g', {}, svg);
        const gCables = el('g', {}, svg);

        L.devices.forEach(d => {
            const g = el('g', { class: 'nl-device', 'data-dev': d.id }, gDevices);
            el('rect', {
                x: d.x, y: d.y, width: d.w, height: d.h, rx: 9,
                fill: 'url(#nl-chassis)', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 1
            }, g);

            const vents = Math.min(7, Math.floor((d.h - 16) / 6));
            for (let i = 0; i < vents; i++) {
                el('rect', {
                    x: d.x + d.w - 20, y: d.y + 12 + i * 6, width: 10, height: 2.4, rx: 1.2,
                    fill: 'rgba(255,255,255,.07)'
                }, g);
            }

            el('circle', { class: 'nl-led', cx: d.x + 16, cy: d.y + 16, r: 4 }, g);
            el('text', { class: 'nl-name', x: d.x + 28, y: d.y + 20 }, g).textContent = d.label;
            el('text', { class: 'nl-sub', x: d.x + 16, y: d.y + 37 }, g).textContent = d.sub;
            const st = el('text', { class: 'nl-state', x: d.x + 16, y: d.y + 51 }, g);
            deviceEls[d.id] = { g: g, state: st };
        });

        Object.keys(L.ports).forEach(id => {
            const p = L.ports[id];
            const vert = p.dir === 'up' || p.dir === 'down';
            const w = vert ? 18 : 14, h = vert ? 14 : 18;
            const g = el('g', { class: 'nl-jack', 'data-port': id }, gJacks);
            el('rect', {
                x: p.x - w / 2, y: p.y - h / 2, width: w, height: h, rx: 2.5,
                fill: '#0b0e13', stroke: 'rgba(255,255,255,.2)'
            }, g);
            el('rect', {
                x: p.x - w / 2 + 3, y: p.y - h / 2 + 3, width: w - 6, height: h - 6, rx: 1.5,
                fill: 'rgba(120,190,255,.14)'
            }, g);
        });

        L.cables.forEach(c => {
            if (state[current][c.id] === undefined) state[current][c.id] = true;

            const g = el('g', {
                class: 'nl-cable', 'data-cable': c.id, tabindex: '0', role: 'button'
            }, gCables);

            const hit = el('path', { class: 'nl-hit', fill: 'none' }, g);
            const jacket = el('path', {
                class: 'nl-jacket', fill: 'none', stroke: c.color,
                'stroke-width': 7, 'stroke-linecap': 'round'
            }, g);
            const sheen = el('path', {
                class: 'nl-sheen', fill: 'none', stroke: '#ffffff',
                'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-opacity': '.22'
            }, g);

            const plug = el('g', { class: 'nl-plug' }, g);
            el('rect', { x: -32, y: -7.5, width: 17, height: 15, rx: 4, fill: c.color }, plug);
            el('rect', { x: -31, y: -4, width: 15, height: 2, rx: 1, fill: 'rgba(255,255,255,.28)' }, plug);
            el('rect', {
                x: -17, y: -6.5, width: 17, height: 13, rx: 2,
                fill: '#c9d2de', stroke: '#798797', 'stroke-width': 1
            }, plug);
            el('rect', {
                x: -14, y: -11, width: 7.5, height: 5, rx: 1.5,
                fill: '#c9d2de', stroke: '#798797', 'stroke-width': 1
            }, plug);
            el('path', {
                d: 'M-4.5 -4 v8 M-7.5 -4 v8 M-10.5 -4 v8',
                stroke: '#d9b45a', 'stroke-width': 1.3, 'stroke-linecap': 'round'
            }, plug);

            el('title', {}, g).textContent = c.label;
            cableEls[c.id] = { g: g, hit: hit, jacket: jacket, sheen: sheen, plug: plug, loose: null };
            wire(c, g);
        });

        render();
    }

    /* ── Geometry + render ─────────────────────────────────── */
    function geometry(c) {
        const plugged = state[current][c.id] !== false;
        const a = anchor(L.ports[c.a]);
        const end = plugged ? anchor(L.ports[c.b]) : (cableEls[c.id].loose || restPoint(c));
        const dist = Math.hypot(end.x - a.x, end.y - a.y);
        const mid = { x: (a.x + end.x) / 2, y: (a.y + end.y) / 2 };

        // Short runs between stacked gear bow their slack out sideways
        // rather than pulling taut, the way a real patch lead loops.
        if (plugged && dist < 110) {
            return { a: a, end: end, ctrl: { x: mid.x + 74, y: mid.y } };
        }
        const sag = plugged ? 14 + dist * 0.07 : 30 + dist * 0.14;
        return { a: a, end: end, ctrl: { x: mid.x, y: mid.y + sag } };
    }

    function render() {
        const live = reachable();
        const plugged = state[current];

        L.cables.forEach(c => {
            const parts = cableEls[c.id];
            const g = geometry(c);
            const d = 'M' + g.a.x + ' ' + g.a.y + ' Q ' + g.ctrl.x + ' ' + g.ctrl.y + ' ' + g.end.x + ' ' + g.end.y;
            parts.hit.setAttribute('d', d);
            parts.jacket.setAttribute('d', d);
            parts.sheen.setAttribute('d', d);

            const angle = Math.atan2(g.end.y - g.ctrl.y, g.end.x - g.ctrl.x) * 180 / Math.PI;
            parts.plug.setAttribute('transform',
                'translate(' + g.end.x + ' ' + g.end.y + ') rotate(' + angle + ')');

            const isOut = plugged[c.id] === false;
            parts.g.classList.toggle('is-out', isOut);
            parts.g.setAttribute('aria-pressed', String(isOut));
            parts.g.setAttribute('aria-label', c.label + ' — ' +
                (isOut ? 'disconnected, activate to reconnect' : 'connected, activate to disconnect'));
        });

        L.devices.forEach(d => {
            const up = live.has(d.id);
            deviceEls[d.id].g.classList.toggle('is-down', !up);
            deviceEls[d.id].state.textContent = up ? 'ONLINE' : 'BROKEN';
        });

        panel(live);
    }

    /* ── Side panel ────────────────────────────────────────── */
    const list = document.getElementById('lab-status');
    const note = document.getElementById('lab-note');
    const heading = document.getElementById('lab-scene-title');

    function panel(live) {
        if (heading) heading.textContent = SCENES[current].title;

        if (list) {
            list.innerHTML = '';
            L.devices.forEach(d => {
                const li = document.createElement('li');
                li.className = live.has(d.id) ? 'up' : 'down';
                const dot = document.createElement('i');
                const name = document.createElement('span');
                name.textContent = d.label;
                const st = document.createElement('b');
                st.textContent = live.has(d.id) ? 'OK' : 'OUT';
                li.append(dot, name, st);
                list.appendChild(li);
            });
        }

        if (note) {
            const out = L.cables.filter(c => state[current][c.id] === false).length;
            const dead = L.devices.length - live.size;
            note.textContent = out === 0
                ? SCENES[current].note
                : out + (out === 1 ? ' link cut · ' : ' links cut · ') + dead +
                (dead === 1 ? ' stage' : ' stages') + ' offline';
        }
    }

    /* ── Interaction ───────────────────────────────────────── */
    function pointInSvg(evt) {
        const r = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        return {
            x: (evt.clientX - r.left) / r.width * vb.width,
            y: (evt.clientY - r.top) / r.height * vb.height
        };
    }

    let drag = null;

    function wire(c, g) {
        g.addEventListener('pointerdown', evt => {
            evt.preventDefault();
            drag = { id: c.id, start: pointInSvg(evt), moved: false };
            try { g.setPointerCapture(evt.pointerId); } catch (e) { }
        });

        g.addEventListener('pointermove', evt => {
            if (!drag || drag.id !== c.id) return;
            const p = pointInSvg(evt);
            if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 6) return;
            drag.moved = true;
            state[current][c.id] = false;
            cableEls[c.id].loose = p;
            render();
        });

        g.addEventListener('pointerup', evt => {
            if (!drag || drag.id !== c.id) return;
            try { g.releasePointerCapture(evt.pointerId); } catch (e) { }

            if (!drag.moved) {
                state[current][c.id] = state[current][c.id] === false;
                cableEls[c.id].loose = null;
            } else {
                const home = anchor(L.ports[c.b]);
                const p = cableEls[c.id].loose || home;
                if (Math.hypot(p.x - home.x, p.y - home.y) < 60) {
                    state[current][c.id] = true;
                    cableEls[c.id].loose = null;
                }
            }
            drag = null;
            render();
        });

        g.addEventListener('pointercancel', () => { drag = null; });

        g.addEventListener('keydown', evt => {
            if (evt.key === 'Enter' || evt.key === ' ') {
                evt.preventDefault();
                state[current][c.id] = state[current][c.id] === false;
                cableEls[c.id].loose = null;
                render();
            }
        });
    }

    /* ── Tabs + reset ──────────────────────────────────────── */
    const tabWrap = document.getElementById('lab-tabs');
    if (tabWrap) {
        ORDER.forEach(key => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'lab-tab';
            b.dataset.scene = key;
            b.textContent = SCENES[key].tab;
            b.setAttribute('aria-pressed', String(key === current));
            b.addEventListener('click', () => {
                if (key === current) return;
                current = key;
                tabWrap.querySelectorAll('.lab-tab').forEach(t =>
                    t.setAttribute('aria-pressed', String(t.dataset.scene === key)));
                build();
            });
            tabWrap.appendChild(b);
        });
    }

    const reset = document.getElementById('lab-reset');
    if (reset) {
        reset.addEventListener('click', () => {
            L.cables.forEach(c => {
                state[current][c.id] = true;
                cableEls[c.id].loose = null;
            });
            render();
        });
    }

    // Re-lay-out when crossing the breakpoint. The media-query event is the
    // primary signal; the debounced resize is a fallback for browsers that
    // miss it, and both funnel through the same no-op-if-unchanged check.
    const onBreak = () => {
        const now = narrowQuery.matches;
        if (now === narrow) return;
        narrow = now;
        build();
    };
    if (narrowQuery.addEventListener) narrowQuery.addEventListener('change', onBreak);
    else narrowQuery.addListener(onBreak);

    let resizeTimer;
    addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(onBreak, 180);
    }, { passive: true });

    if (reduced) svg.classList.add('nl-still');

    build();
})();
