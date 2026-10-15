/**
 * Cerea — prova del foglio ordini: invia 20 ordini FINTI all'app web di Apps Script.
 *
 * Come usarlo:
 *  1. Apri una pagina qualsiasi del sito (anche il file cerea-panettone.html scaricato).
 *  2. Premi F12 (oppure tasto destro > Ispeziona) e vai nella scheda "Console".
 *  3. Incolla tutto questo testo e premi Invio. (Se Chrome lo blocca, scrivi prima: consenti incolla)
 *  4. Guarda il foglio Google: devono comparire le righe e, nel foglio "Produzione", i totali per giorno.
 *
 * Gli ordini finti hanno nome "PROVA …" e nota "ORDINE DI PROVA": per toglierli basta filtrare la colonna
 * Note del foglio "Ordini" e cancellare quelle righe.
 */
(async () => {
  const URL = 'https://script.google.com/macros/s/AKfycbzlFyK3HkfNbJqQNFh9bvwqZ_rVo6xlaFkTPrkEq63_WYCjJFPi3t8LFOn0qDaq5Q6k/exec';
  const TOKEN = '8675a9933ce08872a33a5b4f';

  const FLAVORS = ['Classico', 'Pesche semi candite e caramello', 'Marron glacé', 'Cacao e cioccolato'];
  const SIZES = [['750 g', 34], ['1 kg', 45]];
  const NAMES = ['Mario Rossi', 'Giulia Bianchi', 'Luca Verdi', 'Anna Neri', 'Paolo Gallo', 'Sara Costa',
                 'Marco Ferrari', 'Elena Romano', 'Davide Greco', 'Chiara Conti', 'Andrea Bruno', 'Laura Mancini',
                 'Stefano Rizzo', 'Francesca Lombardi', 'Giorgio Moretti', 'Martina Barbieri', 'Simone Fontana',
                 'Valentina Santoro', 'Matteo Marino', 'Alice Giordano'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // prossimi giorni di ritiro validi: martedì-sabato, da 3 giorni da oggi
  const days = [];
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3);
  while (days.length < 12) { if (d.getDay() !== 0 && d.getDay() !== 1) days.push(iso(d)); d.setDate(d.getDate() + 1); }

  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  let ok = 0, unknown = 0, fail = 0;

  for (let i = 0; i < 20; i++) {
    const lines = new Map();
    for (let k = 0, n = 1 + Math.floor(Math.random() * 3); k < n; k++) {
      const f = pick(FLAVORS), s = pick(SIZES);
      lines.set(f + '|' + s[0], { flavor: f, size: s[0], qty: 1 + Math.floor(Math.random() * 3), price: s[1] });
    }
    const payload = {
      token: TOKEN,
      id: `TEST-${stamp}-${pad(i + 1)}`,
      name: `PROVA ${NAMES[i]}`,
      phone: `+39333000${pad(i + 1)}${pad(i + 1)}`,
      date: pick(days),
      notes: 'ORDINE DI PROVA',
      items: [...lines.values()].map((l) => ({ flavor: l.flavor, size: l.size, qty: l.qty, amount: l.price * l.qty })),
    };
    const init = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) };
    try {
      const res = await fetch(URL, init);                    // se il browser lo permette, leggiamo la risposta
      const json = await res.json();
      json.ok ? ok++ : fail++;
      console.log(`${i + 1}/20 ${payload.id}`, json);
    } catch (e) {
      try { await fetch(URL, { ...init, mode: 'no-cors' }); unknown++; console.log(`${i + 1}/20 ${payload.id} inviato (risposta non leggibile)`); }
      catch (e2) { fail++; console.log(`${i + 1}/20 ${payload.id} ERRORE`, e2.message); }
    }
    await new Promise((r) => setTimeout(r, 500));            // una pausa tra un ordine e l'altro
  }
  console.log(`Fatto. Confermati: ${ok} · inviati senza conferma: ${unknown} · errori: ${fail}. Ora controlla il foglio.`);
})();
