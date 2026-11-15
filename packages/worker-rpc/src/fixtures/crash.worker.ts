import { exposeApi } from "../worker";

exposeApi({ add: (a: number, b: number) => a + b });

throw new Error("crashed at top level");
