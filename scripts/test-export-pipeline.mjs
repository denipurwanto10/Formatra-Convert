import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";
import {
  planRedaction,
  applyRedactions,
  writePageOperations,
  getPageOperations,
  buildOperatorRecords,
  guessStandardFont,
} from "../src/features/editor/pdfTextRedact.js";
import { wrapTextToWidth } from "../src/features/editor/textWrap.js";

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok  -", msg);
}

async function main() {
  // Build a source PDF with two independent lines (each its own Td+Tj, so
  // both are individually "safe" to redact).
  const src = await PDFDocument.create();
  const font = await src.embedFont(StandardFonts.Helvetica);
  const page = src.addPage([300, 200]);
  page.drawText("Invoice Total: 100", { x: 20, y: 150, size: 14, font, color: rgb(0, 0, 0) });
  page.drawText("Customer: Budi", { x: 20, y: 120, size: 12, font, color: rgb(0, 0, 1) });
  const srcBytes = await src.save();

  // Simulate what textLines.js would have produced from pdf.js for this page.
  const flatItems = [{ text: "Invoice Total: 100" }, { text: "Customer: Budi" }];
  const lines = [
    { text: "Invoice Total: 100", left: 20, fontSize: 14, italic: false, baselineY: 150, itemIndices: [0] },
    { text: "Customer: Budi", left: 20, fontSize: 12, italic: false, baselineY: 120, itemIndices: [1] },
  ];

  // Now do what pdfExport.js does: load, copy page into an output doc, redact + redraw.
  const sourceDoc = await PDFDocument.load(srcBytes);
  const out = await PDFDocument.create();
  const [copied] = await out.copyPages(sourceDoc, [0]);
  const outPage = out.addPage(copied);

  const editedLineIndices = [0]; // user edited line 0 only
  const plan = planRedaction({ pdfLibPage: outPage, flatItems, lines, editedLineIndices });
  assert(plan.supported, "plan supported for a simple two-line page");
  assert(plan.safeLineIndices.has(0), "line 0 flagged safe to redact");

  applyRedactions(plan, lines, editedLineIndices);
  writePageOperations(outPage, plan.operations);

  const info = plan.lineInfo.get(0);
  assert(info.color === "#000000", `captured original black colour (got ${info.color})`);
  const guess = guessStandardFont(info.fontBaseName, lines[0].italic);
  const outFont = await out.embedFont(StandardFonts.Helvetica); // guess resolves to helvetica family here
  outPage.drawText("Invoice Total: 250.000", {
    x: lines[0].left,
    y: lines[0].baselineY,
    size: lines[0].fontSize,
    font: outFont,
    color: rgb(0, 0, 0),
  });

  const finalBytes = await out.save();
  const finalDoc = await PDFDocument.load(finalBytes);
  const finalPage = finalDoc.getPage(0);
  const finalOps = getPageOperations(finalPage);
  const finalRecords = buildOperatorRecords(finalOps, finalPage.node.normalizedEntries().Resources);
  const texts = finalRecords.map((r) => r.text);

  assert(!texts.includes("Invoice Total: 100"), "original 'Invoice Total: 100' is gone from the content stream");
  assert(texts.includes("Invoice Total: 250.000"), "new text is present as real vector text");
  assert(texts.includes("Customer: Budi"), "untouched line survived completely intact");
  assert(texts.filter((t) => t === "").length >= 1, "the blanked original operator still exists but draws nothing");

  console.log("\nFull export pipeline integration test passed.");
}

async function testWordWrap() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 14;
  const maxWidth = 150;

  const long =
    "This is a much longer replacement sentence that should wrap onto multiple lines within the box width";
  const wrapped = wrapTextToWidth(long, font, fontSize, maxWidth);
  assert(wrapped.length > 1, `long replacement text wraps into multiple lines (got ${wrapped.length})`);
  assert(
    wrapped.every((l) => font.widthOfTextAtSize(l, fontSize) <= maxWidth + 0.01),
    "every wrapped line fits within the box width"
  );
  assert(wrapped.join(" ").replace(/\s+/g, " ") === long, "wrapping preserves every word, none dropped");

  const short = "Short line";
  const notWrapped = wrapTextToWidth(short, font, fontSize, maxWidth);
  assert(notWrapped.length === 1 && notWrapped[0] === short, "short text that fits stays on one line");

  const hardBreak = "First paragraph\nSecond paragraph";
  const withBreaks = wrapTextToWidth(hardBreak, font, fontSize, 0);
  assert(
    withBreaks.length === 2 && withBreaks[0] === "First paragraph" && withBreaks[1] === "Second paragraph",
    "explicit newlines are respected as hard breaks even with no wrap width"
  );

  console.log("Word-wrap export test passed.");
}

main()
  .then(testWordWrap)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
