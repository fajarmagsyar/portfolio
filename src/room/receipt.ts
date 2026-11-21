// The receipt is read by sliding it with a drag. The drag is the same one that turns other
// things in the hand (see orbit.ts), so how far it may go is asked for here.

/** metres the paper slides for each unit of drag: one pixel of the screen for one pixel of the pointer, near enough */
export const RECEIPT_SLIDE = 0.034;

/** how far it can be slid, in units of drag; set once the receipt has been printed and its length is known */
export const receiptRange = { max: 4 };
