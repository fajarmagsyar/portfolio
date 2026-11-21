import { asset } from "@/asset";
import type { StringKey } from "@/content/strings";
import { useRoom } from "./store";

/**
 * What the thing under the pointer does, shown beside the pointer, with the pointer turned
 * into a hand (or whatever `cursor` says: "grab" for things that are dragged). Null puts
 * both back. Every control in the room that can be clicked or dragged says so this way.
 */
/** The pointer over something that is cut: a pair of scissors, held by their pivot. */
export const SCISSORS = `url("${asset("/cursors/scissors.svg")}") 16 16, crosshair`;

export function hint(tip: StringKey | null, cursor = "pointer") {
  useRoom.getState().setTip(tip);
  document.body.style.cursor = tip ? cursor : "";
}
