/* ============================================================
   Network Lab — an interactive patch panel.
   Click or drag a cable to unplug it; anything downstream of the
   break loses link. Drag a loose connector back onto its port to
   plug it in again.
   ============================================================ */
(function () {
    'use strict';

    const svg = document.getElementById('net-svg');
    if (!svg) return;

    const NS = 'http://www.w3.org/2000/svg';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Topology ──────────────────────────────────────────── */
    const DEVICES = [
        { id: 'ont', label: 'Fiber ONT', sub: 'WAN uplink', x: 40, y: 20, w: 200, h: 62 },
        { id: 'fw', label: 'Firewall', sub: 'VLANs · DNS · WireGuard', x: 40, y: 170, w: 200, h: 62 },
        { id: 'sw', label: 'Core Switch', sub: '8-port managed', x: 40, y: 300, w: 240, h: 110 },
        { id: 'srv', label: 'Server', sub: 'Ubuntu · Docker · Nginx', x: 560, y: 18, w: 224, h: 62 },
        { id: 'ws', label: 'Workstation', sub: 'Dev machine', x: 560, y: 118, w: 224, h: 62 },
        { id: 'ap', label: 'Access Point', sub: 'Wi-Fi · IoT VLAN', x: 560, y: 218, w: 224, h: 62 },
        { id: 'nas', label: 'NAS', sub: 'Snapshots · backups', x: 560, y: 318, w: 224, h: 62 }
    ];

    const PORTS = {
        'ont.out': { dev: 'ont', x: 140, y: 82, dir: 'down', name: 'LAN' },
        'fw.wan': { dev: 'fw', x: 140, y: 170, dir: 'up', name: 'WAN' },
        'fw.lan': { dev: 'fw', x: 140, y: 232, dir: 'down', name: 'LAN' },
        'sw.up': { dev: 'sw', x: 140, y: 300, dir: 'up', name: 'Uplink' },
        'sw.p1': { dev: 'sw', x: 280, y: 322, dir: 'right', name: 'P1' },
        'sw.p2': { dev: 'sw', x: 280, y: 348, dir: 'right', name: 'P2' },
        'sw.p3': { dev: 'sw', x: 280, y: 374, dir: 'right', name: 'P3' },
        'sw.p4': { dev: 'sw', x: 280, y: 400, dir: 'right', name: 'P4' },
        'srv.in': { dev: 'srv', x: 560, y: 49, dir: 'left', name: 'eth0' },
        'ws.in': { dev: 'ws', x: 560, y: 149, dir: 'left', name: 'eth0' },
        'ap.in': { dev: 'ap', x: 560, y: 249, dir: 'left', name: 'PoE' },
        'nas.in': { dev: 'nas', x: 560, y: 349, dir: 'left', name: 'eth0' }
    };

    const CABLES = [
        { id: 'c1', a: 'ont.out', b: 'fw.wan', color: '#3b82f6', label: 'ONT → Firewall WAN' },
        { id: 'c2', a: 'fw.lan', b: 'sw.up', color: '#f59e0b', label: 'Firewall LAN → Switch uplink' },
        { id: 'c3', a: 'sw.p1', b: 'srv.in', color: '#22c55e', label: 'Switch P1 → Server' },
        { id: 'c4', a: 'sw.p2', b: 'ws.in', color: '#cbd5e1', label: 'Switch P2 → Workstation' },
        { id: 'c5', a: 'sw.p3', b: 'ap.in', color: '#38bdf8', label: 'Switch P3 → Access Point' },
        { id: 'c6', a: 'sw.p4', b: 'nas.in', color: '#eab308', label: 'Switch P4 → NAS' }
    ];

    const plugged = {};
    CABLES.forEach(c => { plugged[c.id] = true; });

    /* ── Helpers ───────────────────────────────────────────── */
    function el(tag, attrs, parent) {
        const n = document.createElementNS(NS, tag);
        for (const k in attrs) n.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(n);
        return n;
    }

    // Where the plug tip sits when seated in the jack.
    function anchor(p) {
        const D = 20;
        if (p.dir === 'right') return { x: p.x + D, y: p.y };
        if (p.dir === 'left') return { x: p.x - D, y: p.y };
        if (p.dir === 'up') return { x: p.x, y: p.y - D };
        return { x: p.x, y: p.y + D };
    }

    // Where a loose end hangs when unplugged.
    function restPoint(c) {
        const a = anchor(PORTS[c.a]);
        const b = anchor(PORTS[c.b]);
        return { x: (a.x + b.x) / 2 + 30, y: Math.max(a.y, b.y) + 96 };
    }

    // Which devices can still reach the ONT through plugged cables.
    function reachable() {
        const adj = {};
        DEVICES.forEach(d => { adj[d.id] = []; });
        CABLES.forEach(c => {
            if (!plugged[c.id]) return;
            const x = PORTS[c.a].dev, y = PORTS[c.b].dev;
            adj[x].push(y);
            adj[y].push(x);
        });
        const seen = new Set(['ont']);
        const queue = ['ont'];
        while (queue.length) {
            const n = queue.shift();
            adj[n].forEach(m => { if (!seen.has(m)) { seen.add(m); queue.push(m); } });
        }
        return seen;
    }

    /* ── Static scene ──────────────────────────────────────── */
    const defs = el('defs', {}, svg);

    const chassis = el('linearGradient', { id: 'nl-chassis', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#2b3038' }, chassis);
    el('stop', { offset: '1', 'stop-color': '#171a20' }, chassis);

    const gLinks = el('g', {}, svg);
    const gDevices = el('g', {}, svg);
    const gCables = el('g', {}, svg);

    const deviceEls = {};

    DEVICES.forEach(d => {
        const g = el('g', { class: 'nl-device', 'data-dev': d.id }, gDevices);
        el('rect', {
            x: d.x, y: d.y, width: d.w, height: d.h, rx: 9,
            fill: 'url(#nl-chassis)', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 1
        }, g);

        // vent slots, for a bit of chassis texture
        for (let i = 0; i < 7; i++) {
            el('rect', {
                x: d.x + d.w - 20, y: d.y + 12 + i * 6, width: 10, height: 2.4, rx: 1.2,
                fill: 'rgba(255,255,255,.07)'
            }, g);
        }

        el('circle', { class: 'nl-led', cx: d.x + 16, cy: d.y + 16, r: 4 }, g);
        el('text', { class: 'nl-name', x: d.x + 28, y: d.y + 20 }, g).textContent = d.label;
        el('text', { class: 'nl-sub', x: d.x + 16, y: d.y + 38 }, g).textContent = d.sub;
        const state = el('text', { class: 'nl-state', x: d.x + 16, y: d.y + 54 }, g);

        deviceEls[d.id] = { g, state };
    });

    // Jacks
    Object.keys(PORTS).forEach(id => {
        const p = PORTS[id];
        const vertical = p.dir === 'up' || p.dir === 'down';
        const w = vertical ? 18 : 14;
        const h = vertical ? 14 : 18;
        const g = el('g', { class: 'nl-jack', 'data-port': id }, gLinks);
        el('rect', {
            x: p.x - w / 2, y: p.y - h / 2, width: w, height: h, rx: 2.5,
            fill: '#0b0e13', stroke: 'rgba(255,255,255,.2)'
        }, g);
        el('rect', {
            x: p.x - w / 2 + 3, y: p.y - h / 2 + 3, width: w - 6, height: h - 6, rx: 1.5,
            fill: 'rgba(120,190,255,.14)'
        }, g);
    });

    /* ── Cables ────────────────────────────────────────────── */
    const cableEls = {};

    CABLES.forEach(c => {
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

        // RJ45 plug, drawn pointing along +x with the tip at the origin
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

        g.appendChild(document.createElementNS(NS, 'title')).textContent = c.label;

        cableEls[c.id] = { g, hit, jacket, sheen, plug, loose: null };
    });

    /* ── Geometry ──────────────────────────────────────────── */
    function geometry(c) {
        const a = anchor(PORTS[c.a]);
        const end = plugged[c.id]
            ? anchor(PORTS[c.b])
            : (cableEls[c.id].loose || restPoint(c));

        const dist = Math.hypot(end.x - a.x, end.y - a.y);
        const mid = { x: (a.x + end.x) / 2, y: (a.y + end.y) / 2 };

        // Short runs between stacked gear get their slack bowed out sideways,
        // the way a real patch lead loops rather than pulling taut.
        if (plugged[c.id] && dist < 110) {
            return { a, end, ctrl: { x: mid.x + 74, y: mid.y } };
        }

        const sag = plugged[c.id] ? 14 + dist * 0.07 : 30 + dist * 0.14;
        return { a, end, ctrl: { x: mid.x, y: mid.y + sag } };
    }

    function render() {
        const live = reachable();

        CABLES.forEach(c => {
            const parts = cableEls[c.id];
            const { a, end, ctrl } = geometry(c);
            const d = 'M' + a.x + ' ' + a.y + ' Q ' + ctrl.x + ' ' + ctrl.y + ' ' + end.x + ' ' + end.y;

            parts.hit.setAttribute('d', d);
            parts.jacket.setAttribute('d', d);
            parts.sheen.setAttribute('d', d);

            // point the plug along the curve's final tangent
            const angle = Math.atan2(end.y - ctrl.y, end.x - ctrl.x) * 180 / Math.PI;
            parts.plug.setAttribute('transform',
                'translate(' + end.x + ' ' + end.y + ') rotate(' + angle + ')');

            parts.g.classList.toggle('is-out', !plugged[c.id]);
            parts.g.setAttribute('aria-pressed', String(!plugged[c.id]));
            parts.g.setAttribute('aria-label',
                c.label + ' — ' + (plugged[c.id] ? 'connected, activate to unplug'
                    : 'unplugged, activate to reconnect'));
        });

        DEVICES.forEach(d => {
            const up = live.has(d.id);
            const parts = deviceEls[d.id];
            parts.g.classList.toggle('is-down', !up);
            parts.state.textContent = up ? 'LINK UP' : 'NO LINK';
        });

        renderPanel(live);
    }

    /* ── Status panel ──────────────────────────────────────── */
    const panel = document.getElementById('lab-status');

    function renderPanel(live) {
        if (!panel) return;
        panel.innerHTML = '';
        DEVICES.forEach(d => {
            const li = document.createElement('li');
            li.className = live.has(d.id) ? 'up' : 'down';
            const dot = document.createElement('i');
            const name = document.createElement('span');
            name.textContent = d.label;
            const st = document.createElement('b');
            st.textContent = live.has(d.id) ? 'UP' : 'DOWN';
            li.append(dot, name, st);
            panel.appendChild(li);
        });

        const outCount = CABLES.filter(c => !plugged[c.id]).length;
        const note = document.getElementById('lab-note');
        if (note) {
            note.textContent = outCount === 0
                ? 'All six links are up. Pull one and watch what drops.'
                : outCount + (outCount === 1 ? ' cable' : ' cables') + ' unplugged · ' +
                (DEVICES.length - live.size) + ' device(s) offline';
        }
    }

    /* ── Interaction ───────────────────────────────────────── */
    function toggle(id) {
        plugged[id] = !plugged[id];
        cableEls[id].loose = null;
        render();
    }

    function pointInSvg(evt) {
        const r = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        return {
            x: (evt.clientX - r.left) / r.width * vb.width,
            y: (evt.clientY - r.top) / r.height * vb.height
        };
    }

    let drag = null;

    CABLES.forEach(c => {
        const g = cableEls[c.id].g;

        g.addEventListener('pointerdown', evt => {
            evt.preventDefault();
            const start = pointInSvg(evt);
            drag = { id: c.id, start, moved: false, wasPlugged: plugged[c.id] };
            g.setPointerCapture(evt.pointerId);
        });

        g.addEventListener('pointermove', evt => {
            if (!drag || drag.id !== c.id) return;
            const p = pointInSvg(evt);
            if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 6) return;
            drag.moved = true;
            // dragging always pulls the plug out and follows the pointer
            plugged[c.id] = false;
            cableEls[c.id].loose = p;
            render();
        });

        g.addEventListener('pointerup', evt => {
            if (!drag || drag.id !== c.id) return;
            try { g.releasePointerCapture(evt.pointerId); } catch (e) { }

            if (!drag.moved) {
                toggle(c.id);            // a plain click just flips it
            } else {
                // released near its own jack? seat it again
                const home = anchor(PORTS[c.b]);
                const p = cableEls[c.id].loose || home;
                if (Math.hypot(p.x - home.x, p.y - home.y) < 52) {
                    plugged[c.id] = true;
                    cableEls[c.id].loose = null;
                } else {
                    cableEls[c.id].loose = p;
                }
                render();
            }
            drag = null;
        });

        g.addEventListener('pointercancel', () => { drag = null; });

        g.addEventListener('keydown', evt => {
            if (evt.key === 'Enter' || evt.key === ' ') {
                evt.preventDefault();
                toggle(c.id);
            }
        });
    });

    const reset = document.getElementById('lab-reset');
    if (reset) {
        reset.addEventListener('click', () => {
            CABLES.forEach(c => { plugged[c.id] = true; cableEls[c.id].loose = null; });
            render();
        });
    }

    if (reduced) svg.classList.add('nl-still');

    render();
})();
