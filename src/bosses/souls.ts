/**
 * Tracks the player's freed soul charges.
 * Gained by breaking Soul Orbs during the final boss phase 2.
 * Spent by using the Soul Call ability.
 */
export const souls = {
  charges: 0,
  
  addCharge() {
    this.charges++;
  },
  
  spendCharge(): boolean {
    if (this.charges <= 0) return false;
    this.charges--;
    return true;
  },
  
  reset() {
    this.charges = 0;
  },
};
