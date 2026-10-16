//@target illustrator
/*
 * Imposition.jsx  —  v1.0.0
 * ----------------------------------------------------------------------------
 * FR : Imposition « step and repeat » avec traits de coupe. Duplique la
 *      sélection (carte de visite, étiquette, ticket, flyer…) autant de fois
 *      que possible sur une feuille d'impression (SRA3, A3, A4, 13 × 19 in…),
 *      ou selon un nombre de colonnes × rangées choisi, centre le bloc,
 *      peut pivoter les copies de 90° si cela en fait tenir davantage,
 *      rogne le fond perdu qui chevaucherait les copies voisines et trace
 *      les traits de coupe en couleur de repérage sur un calque verrouillé.
 *      L'original n'est pas modifié : la feuille est créée sur un nouveau
 *      plan de travail (ou sur le plan de travail actif).
 * EN : Step-and-repeat imposition with crop marks. Duplicates the selection
 *      (business card, label, ticket, flyer…) as many times as fit on a
 *      print sheet (SRA3, A3, A4, 13 × 19 in…), or on a chosen columns × rows
 *      grid, centers the block, can rotate copies 90° when more fit, clips
 *      the bleed that would overlap neighbouring copies and draws crop marks
 *      in Registration colour on a locked layer. The original is left
 *      untouched: the sheet is built on a new artboard (or the active one).
 *
 * Cible / Target : Illustrator CC (2018+) jusqu'aux versions récentes.
 * Statut / Status : NON TESTÉ DANS ILLUSTRATOR — syntaxe ES3 vérifiée (acorn).
 *                   NOT TESTED IN ILLUSTRATOR — ES3 syntax checked (acorn).
 * Annulation / Undo : Ctrl+Z / Cmd+Z. ExtendScript ne permet pas de forcer
 *      une seule étape d'annulation : il peut en falloir plusieurs. Tout ce
 *      qui est créé se trouve sur deux calques dédiés, faciles à supprimer.
 *      ExtendScript cannot force a single undo step: several may be needed.
 *      Everything created sits on two dedicated layers, easy to delete.
 * Conseil : travaillez sur une copie de votre fichier.
 * Tip     : work on a copy of your file.
 * Aucune connexion réseau, aucune collecte de données, aucun fichier écrit.
 * No network access, no data collection, no file written.
 *
 * Licence MIT — (c) 2026 Amirouche Amwanes. Code original.
 */

(function () {

    var VERSION = "1.0.0";

    // ------------------------------------------------------------------
    // Langue / UI language (français si Illustrator est en français)
    // ------------------------------------------------------------------
    var FR = String(app.locale || "").toLowerCase().indexOf("fr") === 0;
    function L(fr, en) { return FR ? fr : en; }

    var MM = 72 / 25.4;              // 1 mm en points / 1 mm in points
    var EPS = 0.01;                  // tolérance en points / tolerance in pt

    // ------------------------------------------------------------------
    // Vérifications de départ / Preconditions
    // ------------------------------------------------------------------
    if (app.documents.length === 0) {
        alert(L("Aucun document ouvert.\nOuvrez un document, sélectionnez l'objet à imposer puis relancez le script.",
                "No document is open.\nOpen a document, select the artwork to impose and run the script again."),
              "Imposition");
        return;
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    // Une sélection de texte (mode édition) renvoie un TextRange, pas un tableau.
    // A text selection (edit mode) returns a TextRange, not an array.
    if (!sel || sel.typename || !sel.length) {
        alert(L("Rien n'est sélectionné.\nSélectionnez avec l'outil Sélection (V) l'objet ou le groupe à imposer (par ex. une carte de visite avec son fond perdu).",
                "Nothing is selected.\nUse the Selection tool (V) to select the object or group to impose (e.g. a business card with its bleed)."),
              "Imposition");
        return;
    }
    var items = [];
    var i;
    for (i = 0; i < sel.length; i++) { items.push(sel[i]); }

    // ------------------------------------------------------------------
    // Outils / Helpers
    // ------------------------------------------------------------------
    function num(t, def) {
        var v = parseFloat(String(t).replace(",", "."));
        return isNaN(v) ? def : v;
    }
    function fmt(v) {                 // nombre lisible / readable number
        var r = Math.round(v * 10) / 10;
        var s = String(r);
        return FR ? s.replace(".", ",") : s;
    }

    // Tracé de masque d'un groupe d'écrêtage / clipping path of a clip group
    function findClipPath(g) {
        var k, p;
        for (k = 0; k < g.pageItems.length; k++) {
            p = g.pageItems[k];
            if (p.typename === "PathItem" && p.clipping) { return p; }
            if (p.typename === "CompoundPathItem" && p.pathItems.length > 0 && p.pathItems[0].clipping) { return p; }
        }
        return null;
    }
    // Limites d'un objet : pour un groupe masqué, celles du masque (le contenu
    // caché ne compte pas). Bounds of an item: for a clip group, the mask's.
    function itemBounds(it, visible) {
        if (it.typename === "GroupItem" && it.clipped) {
            var m = findClipPath(it);
            if (m) { return visible ? m.visibleBounds : m.geometricBounds; }
        }
        return visible ? it.visibleBounds : it.geometricBounds;
    }
    function unionBounds(list, visible) {
        var b = null, k, r;
        for (k = 0; k < list.length; k++) {
            r = itemBounds(list[k], visible);
            if (!b) { b = [r[0], r[1], r[2], r[3]]; }
            else {
                if (r[0] < b[0]) { b[0] = r[0]; }
                if (r[1] > b[1]) { b[1] = r[1]; }
                if (r[2] > b[2]) { b[2] = r[2]; }
                if (r[3] < b[3]) { b[3] = r[3]; }
            }
        }
        return b;
    }

    // Couleur de repérage du document, sinon noir 4 couleurs / noir RVB.
    // Document Registration colour, else rich black / RGB black.
    function registrationColor() {
        var k, sw;
        for (k = 0; k < doc.swatches.length; k++) {
            sw = doc.swatches[k];
            try {
                if (sw.color.typename === "SpotColor" && sw.color.spot.colorType === ColorModel.REGISTRATION) {
                    return sw.color;
                }
            } catch (e) {}
        }
        if (doc.documentColorSpace === DocumentColorSpace.CMYK) {
            var c = new CMYKColor();
            c.cyan = 100; c.magenta = 100; c.yellow = 100; c.black = 100;
            return c;
        }
        var r = new RGBColor();
        r.red = 0; r.green = 0; r.blue = 0;
        return r;
    }

    // ------------------------------------------------------------------
    // Formats de feuille (mm, portrait) / Sheet sizes (mm, portrait)
    // ------------------------------------------------------------------
    var SHEETS = [
        { n: "SRA3 (320 × 450 mm)", w: 320, h: 450 },
        { n: "SRA4 (225 × 320 mm)", w: 225, h: 320 },
        { n: "A3 (297 × 420 mm)", w: 297, h: 420 },
        { n: "A4 (210 × 297 mm)", w: 210, h: 297 },
        { n: "A5 (148 × 210 mm)", w: 148, h: 210 },
        { n: "13 × 19 in (330,2 × 482,6 mm)", w: 330.2, h: 482.6 },
        { n: "12 × 18 in (304,8 × 457,2 mm)", w: 304.8, h: 457.2 },
        { n: "Letter (215,9 × 279,4 mm)", w: 215.9, h: 279.4 },
        { n: "Tabloid (279,4 × 431,8 mm)", w: 279.4, h: 431.8 },
        { n: L("Plan de travail actif", "Active artboard"), w: 0, h: 0, artboard: true },
        { n: L("Personnalisé", "Custom"), w: 320, h: 450, custom: true }
    ];

    var abIndex = doc.artboards.getActiveArtboardIndex();
    var abRect = doc.artboards[abIndex].artboardRect;   // [g, h, d, b] / [l, t, r, b]

    // ------------------------------------------------------------------
    // Dialogue / Dialog
    // ------------------------------------------------------------------
    var w = new Window("dialog", "Imposition v" + VERSION);
    w.orientation = "column";
    w.alignChildren = "fill";

    function row(parent, label, value, chars) {
        var g = parent.add("group");
        g.add("statictext", undefined, label);
        var e = g.add("edittext", undefined, value);
        e.characters = chars || 6;
        return e;
    }

    // --- Format fini / Trim size
    var pTrim = w.add("panel", undefined, L("Format fini (coupe)", "Trim size"));
    pTrim.alignChildren = "left";
    var gRef = pTrim.add("group");
    var rbSel = gRef.add("radiobutton", undefined, L("Limites de la sélection", "Selection bounds"));
    var rbAb = gRef.add("radiobutton", undefined, L("Plan de travail actif", "Active artboard"));
    rbSel.value = true;
    var cbStroke = pTrim.add("checkbox", undefined, L("Inclure l'épaisseur des contours", "Include stroke width"));
    var eBleed = row(pTrim, L("Fond perdu inclus dans l'objet (mm) :", "Bleed included in the artwork (mm):"), "3");
    var gTW = pTrim.add("group");
    gTW.add("statictext", undefined, L("Largeur × hauteur finies (mm) :", "Trim width × height (mm):"));
    var eTW = gTW.add("edittext", undefined, ""); eTW.characters = 7;
    gTW.add("statictext", undefined, "×");
    var eTH = gTW.add("edittext", undefined, ""); eTH.characters = 7;

    // --- Feuille / Sheet
    var pSheet = w.add("panel", undefined, L("Feuille d'impression", "Print sheet"));
    pSheet.alignChildren = "left";
    var gS1 = pSheet.add("group");
    gS1.add("statictext", undefined, L("Format :", "Size:"));
    var ddSheet = gS1.add("dropdownlist");
    for (i = 0; i < SHEETS.length; i++) { ddSheet.add("item", SHEETS[i].n); }
    ddSheet.selection = 0;
    var gS2 = pSheet.add("group");
    gS2.add("statictext", undefined, L("Personnalisé (mm) :", "Custom (mm):"));
    var eSW = gS2.add("edittext", undefined, "320"); eSW.characters = 7;
    gS2.add("statictext", undefined, "×");
    var eSH = gS2.add("edittext", undefined, "450"); eSH.characters = 7;
    var gS3 = pSheet.add("group");
    gS3.add("statictext", undefined, L("Orientation :", "Orientation:"));
    var ddOrient = gS3.add("dropdownlist", undefined, [L("Automatique (le plus d'exemplaires)", "Automatic (most copies)"), L("Portrait", "Portrait"), L("Paysage", "Landscape")]);
    ddOrient.selection = 0;
    var eMargin = row(pSheet, L("Marge de la feuille (mm) :", "Sheet margin (mm):"), "12");

    // --- Disposition / Layout
    var pLay = w.add("panel", undefined, L("Disposition", "Layout"));
    pLay.alignChildren = "left";
    var gL1 = pLay.add("group");
    var rbAuto = gL1.add("radiobutton", undefined, L("Remplir la feuille", "Fill the sheet"));
    var rbMan = gL1.add("radiobutton", undefined, L("Colonnes × rangées :", "Columns × rows:"));
    rbAuto.value = true;
    var eCols = gL1.add("edittext", undefined, "2"); eCols.characters = 4;
    gL1.add("statictext", undefined, "×");
    var eRows = gL1.add("edittext", undefined, "5"); eRows.characters = 4;
    var gL2 = pLay.add("group");
    gL2.add("statictext", undefined, L("Gouttière horizontale / verticale (mm) :", "Horizontal / vertical gutter (mm):"));
    var eGX = gL2.add("edittext", undefined, "0"); eGX.characters = 5;
    var eGY = gL2.add("edittext", undefined, "0"); eGY.characters = 5;
    var gL3 = pLay.add("group");
    gL3.add("statictext", undefined, L("Rotation des copies :", "Rotate copies:"));
    var ddRot = gL3.add("dropdownlist", undefined, [L("Automatique", "Automatic"), "0°", "90°"]);
    ddRot.selection = 0;
    var cbClip = pLay.add("checkbox", undefined, L("Rogner le fond perdu qui chevauche les copies voisines (masque)", "Clip bleed overlapping neighbouring copies (mask)"));
    cbClip.value = true;

    // --- Traits de coupe / Crop marks
    var pMarks = w.add("panel", undefined, L("Traits de coupe", "Crop marks"));
    pMarks.alignChildren = "left";
    var cbMarks = pMarks.add("checkbox", undefined, L("Tracer les traits de coupe (couleur de repérage)", "Draw crop marks (Registration colour)"));
    cbMarks.value = true;
    var gM1 = pMarks.add("group");
    gM1.add("statictext", undefined, L("Longueur (mm) :", "Length (mm):"));
    var eMLen = gM1.add("edittext", undefined, "5"); eMLen.characters = 4;
    gM1.add("statictext", undefined, L("Décalage (mm) :", "Offset (mm):"));
    var eMOff = gM1.add("edittext", undefined, "3"); eMOff.characters = 4;
    gM1.add("statictext", undefined, L("Épaisseur (pt) :", "Weight (pt):"));
    var eMW = gM1.add("edittext", undefined, "0,25"); eMW.characters = 4;
    var cbLegend = pMarks.add("checkbox", undefined, L("Légende dans la marge (nom du fichier, nombre, format)", "Slug line in the margin (file name, count, size)"));
    cbLegend.value = true;

    // --- Résultat / Result
    var stInfo = w.add("statictext", undefined, "", { multiline: true });
    stInfo.preferredSize = [460, 48];
    var stTip = w.add("statictext", undefined, L("Conseil : travaillez sur une copie du fichier. L'original n'est pas modifié.",
                                                 "Tip: work on a copy of the file. The original is left untouched."));

    var gB = w.add("group");
    gB.alignment = "right";
    var btCancel = gB.add("button", undefined, L("Annuler", "Cancel"), { name: "cancel" });
    var btOk = gB.add("button", undefined, L("Imposer", "Impose"), { name: "ok" });

    // ------------------------------------------------------------------
    // Calculs / Computation
    // ------------------------------------------------------------------
    // Remplit largeur/hauteur finies depuis la référence choisie.
    // Fill trim width/height from the chosen reference.
    function fillTrim() {
        var tw, th, bl = num(eBleed.text, 0) * MM;
        if (rbAb.value) {
            tw = abRect[2] - abRect[0];
            th = abRect[1] - abRect[3];
        } else {
            var b = unionBounds(items, cbStroke.value);
            tw = (b[2] - b[0]) - 2 * bl;
            th = (b[1] - b[3]) - 2 * bl;
        }
        eTW.text = fmt(tw / MM);
        eTH.text = fmt(th / MM);
    }

    function fit(avail, size, gap) {
        if (size <= 0) { return 0; }
        var n = Math.floor((avail + gap + EPS) / (size + gap));
        return n < 0 ? 0 : n;
    }

    // Lit le dialogue et calcule la meilleure disposition (tout en points).
    // Reads the dialog and computes the best layout (all in points).
    function compute() {
        var s = {};
        s.bleed = Math.max(0, num(eBleed.text, 0)) * MM;
        s.tw = num(eTW.text, 0) * MM;
        s.th = num(eTH.text, 0) * MM;
        s.gx = Math.max(0, num(eGX.text, 0)) * MM;
        s.gy = Math.max(0, num(eGY.text, 0)) * MM;
        s.margin = Math.max(0, num(eMargin.text, 0)) * MM;
        s.marks = cbMarks.value;
        s.mLen = Math.max(0, num(eMLen.text, 5)) * MM;
        s.mOff = Math.max(0, num(eMOff.text, 3)) * MM;
        s.mW = Math.max(0.05, num(eMW.text, 0.25));
        s.legend = cbLegend.value;
        s.clip = cbClip.value;
        s.manual = rbMan.value;
        s.sheetDef = SHEETS[ddSheet.selection.index];
        s.useArtboard = !!s.sheetDef.artboard;
        s.error = "";

        if (s.tw <= 0 || s.th <= 0) { s.error = L("Format fini invalide.", "Invalid trim size."); return s; }

        var sw0, sh0;
        if (s.useArtboard) {
            sw0 = abRect[2] - abRect[0];
            sh0 = abRect[1] - abRect[3];
        } else if (s.sheetDef.custom) {
            sw0 = num(eSW.text, 0) * MM;
            sh0 = num(eSH.text, 0) * MM;
        } else {
            sw0 = s.sheetDef.w * MM;
            sh0 = s.sheetDef.h * MM;
        }
        if (sw0 <= 0 || sh0 <= 0) { s.error = L("Format de feuille invalide.", "Invalid sheet size."); return s; }

        // Orientations de feuille candidates / candidate sheet orientations
        var sheets = [];
        var pw = Math.min(sw0, sh0), ph = Math.max(sw0, sh0);
        if (s.useArtboard) { sheets.push([sw0, sh0]); }
        else if (ddOrient.selection.index === 1) { sheets.push([pw, ph]); }
        else if (ddOrient.selection.index === 2) { sheets.push([ph, pw]); }
        else { sheets.push([pw, ph]); if (Math.abs(pw - ph) > EPS) { sheets.push([ph, pw]); } }

        var rots = [];
        if (ddRot.selection.index === 1) { rots.push(false); }
        else if (ddRot.selection.index === 2) { rots.push(true); }
        else { rots.push(false); if (Math.abs(s.tw - s.th) > EPS) { rots.push(true); } }

        var mc = Math.max(1, parseInt(eCols.text, 10) || 1);
        var mr = Math.max(1, parseInt(eRows.text, 10) || 1);

        var best = null, a, b, cw, ch, cols, rows, bw, bh, fits, cand;
        // Ordre de préférence à égalité : sans rotation d'abord, portrait d'abord.
        // Tie-break order: no rotation first, portrait first.
        for (b = 0; b < rots.length; b++) {
            for (a = 0; a < sheets.length; a++) {
                cw = rots[b] ? s.th : s.tw;
                ch = rots[b] ? s.tw : s.th;
                var availW = sheets[a][0] - 2 * s.margin;
                var availH = sheets[a][1] - 2 * s.margin;
                if (s.manual) { cols = mc; rows = mr; }
                else { cols = fit(availW, cw, s.gx); rows = fit(availH, ch, s.gy); }
                bw = cols * cw + Math.max(0, cols - 1) * s.gx;
                bh = rows * ch + Math.max(0, rows - 1) * s.gy;
                fits = bw <= availW + EPS && bh <= availH + EPS;
                cand = { sw: sheets[a][0], sh: sheets[a][1], rot: rots[b], cw: cw, ch: ch,
                         cols: cols, rows: rows, bw: bw, bh: bh, fits: fits, count: cols * rows };
                if (!best) { best = cand; }
                else if (s.manual) { if (cand.fits && !best.fits) { best = cand; } }
                else if (cand.count > best.count) { best = cand; }
            }
        }
        for (a in best) { if (best.hasOwnProperty(a)) { s[a] = best[a]; } }
        if (s.count < 1) { s.error = L("Le format fini ne tient pas sur la feuille (marges comprises).", "The trim size does not fit on the sheet (margins included)."); }
        return s;
    }

    function updateInfo() {
        var s = compute();
        eSW.enabled = eSH.enabled = !!s.sheetDef.custom;
        ddOrient.enabled = !s.useArtboard;
        eCols.enabled = eRows.enabled = rbMan.value;
        eMLen.enabled = eMOff.enabled = eMW.enabled = cbMarks.value;
        if (s.error) { stInfo.text = "(!) " + s.error; btOk.enabled = false; return; }
        btOk.enabled = true;
        var t = L("Résultat : ", "Result: ") + s.count + L(" exemplaire(s) ", " copy(ies) ") +
                "(" + s.cols + " × " + s.rows + ")" + (s.rot ? L(", copies pivotées de 90°", ", copies rotated 90°") : "") +
                L(" — feuille ", " — sheet ") + fmt(s.sw / MM) + " × " + fmt(s.sh / MM) + " mm.";
        if (!s.fits) { t += "\n(!) " + L("Le bloc dépasse la zone utile de la feuille.", "The block exceeds the sheet's usable area."); }
        if (s.marks && s.fits) {
            var room = Math.min((s.sw - s.bw) / 2, (s.sh - s.bh) / 2);
            if (room + EPS < s.mOff + s.mLen) {
                t += "\n(!) " + L("Traits de coupe en partie hors feuille : augmentez la marge.", "Crop marks partly off the sheet: increase the margin.");
            }
        }
        if (s.marks && s.mOff + EPS < s.bleed) {
            t += "\n" + L("Note : le décalage des traits est inférieur au fond perdu.", "Note: crop mark offset is smaller than the bleed.");
        }
        stInfo.text = t;
    }

    rbSel.onClick = rbAb.onClick = function () { fillTrim(); updateInfo(); };
    cbStroke.onClick = function () { if (rbSel.value) { fillTrim(); } updateInfo(); };
    eBleed.onChanging = function () { if (rbSel.value) { fillTrim(); } updateInfo(); };
    var live = [eTW, eTH, eSW, eSH, eMargin, eCols, eRows, eGX, eGY, eMLen, eMOff, eMW];
    for (i = 0; i < live.length; i++) { live[i].onChanging = updateInfo; }
    ddSheet.onChange = ddOrient.onChange = ddRot.onChange = updateInfo;
    rbAuto.onClick = rbMan.onClick = cbMarks.onClick = cbClip.onClick = cbLegend.onClick = updateInfo;

    fillTrim();
    updateInfo();

    if (w.show() !== 1) { return; }
    var S = compute();
    if (S.error) { alert(S.error, "Imposition"); return; }
    if (!S.fits) {
        if (!confirm(L("Le bloc dépasse la zone utile de la feuille. Continuer quand même ?",
                       "The block exceeds the sheet's usable area. Continue anyway?"))) { return; }
    }
    if (S.useArtboard) {
        if (!confirm(L("Les copies seront placées sur le plan de travail actif, par-dessus ce qui s'y trouve déjà. Continuer ?",
                       "Copies will be placed on the active artboard, on top of what is already there. Continue?"))) { return; }
    }
    if (S.count > 1000) {
        if (!confirm(L("Plus de 1000 copies vont être créées, cela peut être lent. Continuer ?",
                       "More than 1000 copies will be created, this may be slow. Continue?"))) { return; }
    }

    // ------------------------------------------------------------------
    // Construction / Build
    // ------------------------------------------------------------------
    try {
        build(S);
    } catch (err) {
        alert(L("Erreur pendant l'imposition : ", "Error during imposition: ") + err +
              (err.line ? " (ligne/line " + err.line + ")" : "") +
              L("\nAnnulez avec Ctrl+Z / Cmd+Z si besoin.", "\nUndo with Ctrl+Z / Cmd+Z if needed."), "Imposition");
    }

    function build(s) {
        // 1. Feuille : nouveau plan de travail à droite des autres, ou plan actif.
        //    Sheet: new artboard to the right of the others, or the active one.
        var sheetRect, abNew = null;
        if (s.useArtboard) {
            sheetRect = [abRect[0], abRect[1], abRect[2], abRect[3]];
        } else {
            var k, r, maxR = -1e9, maxT = -1e9;
            for (k = 0; k < doc.artboards.length; k++) {
                r = doc.artboards[k].artboardRect;
                if (r[2] > maxR) { maxR = r[2]; }
                if (r[1] > maxT) { maxT = r[1]; }
            }
            var left = maxR + 72;   // 1 pouce d'écart / 1 inch apart
            sheetRect = [left, maxT, left + s.sw, maxT - s.sh];
            try {
                abNew = doc.artboards.add(sheetRect);
                abNew.name = "Imposition " + s.count + L(" ex.", " up");
            } catch (eAb) {
                throw new Error(L("impossible de créer le plan de travail de la feuille (zone de travail pleine ?). Choisissez « Plan de travail actif » ou réorganisez les plans de travail.",
                                  "cannot create the sheet artboard (canvas full?). Choose \"Active artboard\" or rearrange artboards."));
            }
        }

        // 2. Calques dédiés / dedicated layers
        var layArt = doc.layers.add();
        layArt.name = L("Imposition", "Imposition") + " " + s.count + L(" ex.", " up");
        var layMarks = null;
        if (s.marks || s.legend) {
            layMarks = doc.layers.add();
            layMarks.name = L("Traits de coupe", "Crop marks");
        }

        // 3. Objet maître : copie de la sélection + rectangle témoin du format fini.
        //    Master: copy of the selection + trim marker rectangle.
        var master = layArt.groupItems.add();
        var k2;
        for (k2 = 0; k2 < items.length; k2++) {
            items[k2].duplicate(master, ElementPlacement.PLACEATEND);
        }
        var cx0, cy0;
        if (rbAb.value) {
            cx0 = (abRect[0] + abRect[2]) / 2;
            cy0 = (abRect[1] + abRect[3]) / 2;
        } else {
            var ub = unionBounds(items, cbStroke.value);
            cx0 = (ub[0] + ub[2]) / 2;
            cy0 = (ub[1] + ub[3]) / 2;
        }
        // Rectangle témoin centré sur le format fini (sans fond ni contour).
        // Marker rectangle centered on the trim (no fill, no stroke).
        var marker = master.pathItems.rectangle(cy0 + s.th / 2, cx0 - s.tw / 2, s.tw, s.th);
        marker.filled = false; marker.stroked = false;
        if (s.rot) { master.rotate(90); }
        var mb = marker.geometricBounds;
        var mcx = (mb[0] + mb[2]) / 2, mcy = (mb[1] + mb[3]) / 2;
        marker.remove();

        // 4. Positions des cellules / cell positions
        var bx = sheetRect[0] + (s.sw - s.bw) / 2;
        var by = sheetRect[1] - (s.sh - s.bh) / 2;
        var c, rr, cl, ct, copy, holder, mask, eL, eR, eT, eB;
        var halfX = s.gx / 2, halfY = s.gy / 2;
        for (rr = 0; rr < s.rows; rr++) {
            for (c = 0; c < s.cols; c++) {
                cl = bx + c * (s.cw + s.gx);
                ct = by - rr * (s.ch + s.gy);
                copy = master.duplicate(layArt, ElementPlacement.PLACEATEND);
                copy.translate(cl + s.cw / 2 - mcx, ct - s.ch / 2 - mcy);
                if (s.clip) {
                    // Fond perdu complet à l'extérieur du bloc, limité à la
                    // demi-gouttière entre deux copies.
                    // Full bleed on the block's outer edges, half-gutter inside.
                    eL = c === 0 ? s.bleed : Math.min(s.bleed, halfX);
                    eR = c === s.cols - 1 ? s.bleed : Math.min(s.bleed, halfX);
                    eT = rr === 0 ? s.bleed : Math.min(s.bleed, halfY);
                    eB = rr === s.rows - 1 ? s.bleed : Math.min(s.bleed, halfY);
                    holder = layArt.groupItems.add();
                    copy.move(holder, ElementPlacement.PLACEATEND);
                    mask = holder.pathItems.rectangle(ct + eT, cl - eL, s.cw + eL + eR, s.ch + eT + eB);
                    mask.move(holder, ElementPlacement.PLACEATBEGINNING);
                    holder.clipped = true;
                    holder.name = "copie / copy " + (rr + 1) + "-" + (c + 1);
                } else {
                    copy.name = "copie / copy " + (rr + 1) + "-" + (c + 1);
                }
            }
        }
        master.remove();

        // 5. Traits de coupe / crop marks
        if (s.marks && layMarks) {
            var reg = registrationColor();
            var xs = [], ys = [];
            var addUnique = function (arr, v) {
                var q;
                for (q = 0; q < arr.length; q++) { if (Math.abs(arr[q] - v) < EPS) { return; } }
                arr.push(v);
            };
            for (c = 0; c < s.cols; c++) {
                addUnique(xs, bx + c * (s.cw + s.gx));
                addUnique(xs, bx + c * (s.cw + s.gx) + s.cw);
            }
            for (rr = 0; rr < s.rows; rr++) {
                addUnique(ys, by - rr * (s.ch + s.gy));
                addUnique(ys, by - rr * (s.ch + s.gy) - s.ch);
            }
            var top = by, bottom = by - s.bh, leftB = bx, rightB = bx + s.bw;
            var marksGroup = layMarks.groupItems.add();
            marksGroup.name = L("Traits de coupe", "Crop marks");
            var line = function (x1, y1, x2, y2) {
                var p = marksGroup.pathItems.add();
                p.setEntirePath([[x1, y1], [x2, y2]]);
                p.filled = false;
                p.stroked = true;
                p.strokeWidth = s.mW;
                p.strokeColor = reg;
                p.strokeCap = StrokeCap.BUTTENDCAP;
                return p;
            };
            var q2;
            for (q2 = 0; q2 < xs.length; q2++) {
                line(xs[q2], top + s.mOff, xs[q2], top + s.mOff + s.mLen);
                line(xs[q2], bottom - s.mOff, xs[q2], bottom - s.mOff - s.mLen);
            }
            for (q2 = 0; q2 < ys.length; q2++) {
                line(leftB - s.mOff, ys[q2], leftB - s.mOff - s.mLen, ys[q2]);
                line(rightB + s.mOff, ys[q2], rightB + s.mOff + s.mLen, ys[q2]);
            }
        }

        // 6. Légende / slug line
        if (s.legend && layMarks) {
            var tf = layMarks.textFrames.add();
            tf.contents = doc.name + "  —  " + s.count + L(" ex. ", " up ") + "(" + s.cols + " × " + s.rows + ")  —  " +
                          fmt(s.tw / MM) + " × " + fmt(s.th / MM) + " mm" +
                          L("  —  feuille ", "  —  sheet ") + fmt(s.sw / MM) + " × " + fmt(s.sh / MM) + " mm";
            try {
                tf.textRange.characterAttributes.size = 6;
                tf.textRange.characterAttributes.fillColor = registrationColor();
            } catch (eTxt) {}
            // Tout en bas de la feuille, sous les traits de coupe.
            // At the very bottom of the sheet, below the crop marks.
            tf.left = sheetRect[0] + Math.max(3 * MM, (s.sw - s.bw) / 2);
            tf.top = sheetRect[3] + 3 * MM + tf.height;
        }

        if (layMarks) { layMarks.locked = true; }
        if (abNew) {
            try { doc.artboards.setActiveArtboardIndex(doc.artboards.length - 1); } catch (eAct) {}
        }
        doc.selection = null;
        app.redraw();
        alert(L("Imposition terminée : ", "Imposition done: ") + s.count + L(" exemplaire(s) ", " copy(ies) ") +
              "(" + s.cols + " × " + s.rows + ")" + (s.rot ? L(", pivotées de 90°", ", rotated 90°") : "") + ".\n" +
              L("Calques créés : « ", "Layers created: \"") + layArt.name + (layMarks ? L(" » et « ", "\" and \"") + layMarks.name : "") +
              L(" » (verrouillé).", "\" (locked)."), "Imposition");
    }

})();
