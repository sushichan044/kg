import { consistentNumeralWidthRule } from "@sushichan044/kg-core/lint";

import { startManuscriptWorker } from "../worker";

startManuscriptWorker({
  proofreading: { rules: [consistentNumeralWidthRule()], onCompose: false },
});
