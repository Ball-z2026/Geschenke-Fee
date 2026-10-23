// Die Entwuerfe im Erklaervideo. Gezeichnet und nicht generiert, aus zwei Gruenden:
//
// 1. Der Film lebt davon, dass man den Unterschied zwischen dem ersten Entwurf und dem
//    Konsens-Entwurf SIEHT. Dafuer brauchen beide dasselbe Geruest und Unterschiede an genau
//    den Stellen, die die Gruppe in den Kommentaren genannt hat.
// 2. Video-KI erfindet Oberflaechen und Schrift. Beim Erklaeren eines Mechanismus waere das toedlich.
//
// Die Stile sind die echten aus mottos.js (STYLES): College, Minimalistisch, Neon, Vintage.
// So sieht der Zuschauer im Film das, was die Seite tatsaechlich anbietet.
//
//   entwurfSVG('college')            der erste Entwurf, wie ihn das Orga-Team macht
//   entwurfSVG('college', true)      derselbe Stil nach den Kommentaren - das Konsens-Design
//   entwurfSVG('minimal' | 'neon' | 'vintage')

function entwurfSVG(stil, konsens) {
  var W = 400, mitte = 200;
  var id = stil + (konsens ? '_k' : '');
  var teile = [];
  var add = function (x) { teile.push(x); };
  var text = function (x, y, s, gewicht, sperrung, farbe, inhalt, anker) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anker || 'middle') + '" font-size="' + s +
      '" font-weight="' + gewicht + '" letter-spacing="' + sperrung + '" fill="' + farbe + '">' + inhalt + '</text>';
  };
  var bogen = function (r, farbe, s, sperrung, inhalt) {
    var y = 168, halb = 126;
    return '<defs><path id="bg_' + id + '" d="M ' + (mitte - halb) + ' ' + y + ' A ' + r + ' ' + r + ' 0 0 1 ' + (mitte + halb) + ' ' + y + '" fill="none"/></defs>' +
      '<text font-size="' + s + '" font-weight="700" letter-spacing="' + sperrung + '" fill="' + farbe + '">' +
      '<textPath href="#bg_' + id + '" startOffset="50%" text-anchor="middle">GYMNASIUM HITTFELD</textPath></text>';
  };

  // ---------------------------------------------------------------- College
  // Varsity: Bogenschrift, Blockletter mit Innenlinie, Doppelstreifen, Lorbeer. Zwei Schulfarben.
  if (stil === 'college') {
    var grund = konsens ? '#111a38' : '#151b31';
    var gold  = konsens ? '#ffc542' : '#8b98c4';
    var creme = konsens ? '#fff3d4' : '#c3cbe6';
    var linie = konsens ? '#c9992f' : '#4e5a80';
    add('<rect width="400" height="400" fill="' + grund + '"/>');
    add(bogen(126, linie, 19, 5.5));

    if (konsens) {
      // Emblem gross, mit Strahl und Sternen - der Wunsch aus den Kommentaren
      add('<path d="M168 200 L232 200 L272 316 L128 316 Z" fill="' + gold + '" opacity=".15"/>');
      add('<path d="M156 172 a44 44 0 0 1 88 0 z" fill="#6fe3c8" opacity=".92"/>');
      add('<ellipse cx="200" cy="178" rx="92" ry="29" fill="#6fe3c8"/>');
      add('<ellipse cx="200" cy="172" rx="92" ry="25" fill="#c6f5e9"/>');
      add('<circle cx="164" cy="184" r="7" fill="' + grund + '"/><circle cx="200" cy="188" r="7" fill="' + grund + '"/><circle cx="236" cy="184" r="7" fill="' + grund + '"/>');
      add('<path d="M104 156 l6 15 15 6 -15 6 -6 15 -6 -15 -15 -6 15 -6 z" fill="' + gold + '"/>');
      add('<path d="M300 170 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 z" fill="' + gold + '" opacity=".85"/>');
    } else {
      // zurueckhaltend: fast nur eine Linie
      add('<circle cx="200" cy="180" r="29" fill="none" stroke="' + linie + '" stroke-width="3"/>');
      add('<ellipse cx="200" cy="180" rx="55" ry="17" fill="none" stroke="' + linie + '" stroke-width="3" transform="rotate(-18 200 180)"/>');
      add('<circle cx="200" cy="180" r="8" fill="' + gold + '"/>');
    }

    // Lorbeer links und rechts der Wortmarke - gehoert zum Varsity-Look
    var blatt = function (x, spiegel) {
      var g = '<g transform="translate(' + x + ',282) scale(' + (spiegel ? -1 : 1) + ',1)" fill="' + linie + '">';
      for (var i = 0; i < 4; i++) g += '<ellipse cx="' + (-i * 9) + '" cy="' + (-6 + i * 5) + '" rx="8" ry="3.4" transform="rotate(' + (-38 + i * 6) + ')"/>';
      return g + '</g>';
    };
    add(blatt(64, false) + blatt(336, true));

    if (konsens) {
      add(text(mitte, 296, 60, 900, -3, gold, 'ABIrama'));
      add(text(mitte, 296, 60, 900, -3, 'none', 'ABIrama') .replace('fill="none"', 'fill="none" stroke="' + creme + '" stroke-width="1.2"'));
      add(text(mitte, 334, 18, 800, 4, creme, 'AB JETZT FÜR IMMER'));
    } else {
      add(text(mitte, 292, 36, 700, 7, creme, 'ABIRAMA'));
      add('<line x1="120" y1="312" x2="280" y2="312" stroke="' + linie + '" stroke-width="3"/>');
      add('<line x1="120" y1="320" x2="280" y2="320" stroke="' + linie + '" stroke-width="1.5"/>');
    }
    add(text(mitte, 370, 21, 700, 9, gold, '2026'));
  }

  // ---------------------------------------------------------------- Minimalistisch
  // Eine durchgehende Linie, zwei Farben, viel Luft. Kein Bogen, kein Schmuck.
  else if (stil === 'minimal') {
    add('<rect width="400" height="400" fill="#141419"/>');
    add('<circle cx="200" cy="176" r="52" fill="none" stroke="#e8e6ee" stroke-width="2"/>');
    add('<circle cx="228" cy="152" r="6" fill="#c9c6d4"/>');
    add(text(mitte, 288, 28, 300, 12, '#e8e6ee', 'ABIRAMA'));
    add(text(mitte, 330, 15, 400, 8, '#82808c', '2026'));
  }

  // ---------------------------------------------------------------- Neon
  // Leuchtroehren, Streifensonne, Lasergitter. Alles wirkt von innen beleuchtet.
  else if (stil === 'neon') {
    add('<defs><filter id="gl_' + id + '" x="-60%" y="-60%" width="220%" height="220%">' +
        '<feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
        '<clipPath id="son_' + id + '"><circle cx="200" cy="182" r="66"/></clipPath></defs>');
    add('<rect width="400" height="400" fill="#12082a"/>');
    add('<circle cx="200" cy="182" r="66" fill="#ff3d9a"/>');
    add('<g clip-path="url(#son_' + id + ')" fill="#12082a">' +
        '<rect x="130" y="196" width="140" height="7"/><rect x="130" y="212" width="140" height="9"/><rect x="130" y="231" width="140" height="12"/></g>');
    for (var i = 0; i < 7; i++) add('<line x1="' + (30 + i * 57) + '" y1="330" x2="' + (-90 + i * 145) + '" y2="400" stroke="#37f0ff" stroke-width="1.6" opacity=".7"/>');
    add('<line x1="0" y1="330" x2="400" y2="330" stroke="#37f0ff" stroke-width="2" opacity=".8"/>');
    add('<line x1="0" y1="352" x2="400" y2="352" stroke="#37f0ff" stroke-width="1.4" opacity=".55"/>');
    add('<g filter="url(#gl_' + id + ')">' + text(mitte, 300, 50, 900, -2, '#fff0fb', 'ABIrama') + '</g>');
    add(text(mitte, 300, 50, 900, -2, '#ffffff', 'ABIrama'));
    add(text(mitte, 372, 16, 700, 9, '#37f0ff', '2026'));
  }

  // ---------------------------------------------------------------- Vintage
  // Siebdruck der Siebziger: gedeckte Farben, Bogenschrift, Banderole, Korn.
  else if (stil === 'vintage') {
    add('<defs><filter id="kor_' + id + '"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3"/>' +
        '<feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".22"/></feComponentTransfer></filter></defs>');
    add('<rect width="400" height="400" fill="#2b2018"/>');
    for (var s = 0; s < 3; s++) add('<rect x="0" y="' + (238 + s * 15) + '" width="400" height="8" fill="' + ['#c9682f', '#c9922f', '#7f8b5a'][s] + '" opacity=".85"/>');
    add(bogen(126, '#c9922f', 18, 5));
    add('<circle cx="200" cy="182" r="42" fill="none" stroke="#e6d3a8" stroke-width="3"/>');
    add('<circle cx="200" cy="182" r="27" fill="#c9682f"/>');
    add(text(mitte, 316, 34, 800, 2, '#e6d3a8', 'ABIRAMA'));
    // Banderole
    add('<path d="M78 330 L322 330 L306 358 L94 358 Z" fill="#c9682f"/>' +
        '<path d="M78 330 L64 344 L78 358 Z" fill="#8f4820"/><path d="M322 330 L336 344 L322 358 Z" fill="#8f4820"/>');
    add(text(mitte, 351, 16, 800, 4, '#f6ecd8', 'ABGANG 2026'));
    add('<rect width="400" height="400" filter="url(#kor_' + id + ')" opacity=".5" style="mix-blend-mode:overlay"/>');
  }

  return '<svg viewBox="0 0 400 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" ' +
    'font-family="Archivo, Arial, sans-serif">' + teile.join('') + '</svg>';
}

// Anzeigename des Stils - so, wie er auch auf der Motto-Seite steht
var STIL_LABEL = { college: 'College', minimal: 'Minimalistisch', neon: 'Neon', vintage: 'Vintage' };

if (typeof module !== 'undefined') module.exports = { entwurfSVG: entwurfSVG, STIL_LABEL: STIL_LABEL };
