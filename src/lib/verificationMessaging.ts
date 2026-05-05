/** Shared copy for Ghana Lands Commission verification expectations */

export const VERIFICATION_HOURS_RANGE = '24 to 48 hours';

export const VERIFICATION_TIMELINE_SUMMARY = `Verification is not instant. Ghana Lands Commission reviews submissions (including Ghana Card identity checks). You should receive an email update within ${VERIFICATION_HOURS_RANGE}.`;

/** Buyer / investor: Ghana Card for identity (no separate seller registry account queue). */
export const SIGNUP_TIMELINE_BUYER = `After you sign in, you complete Ghana Card verification. Ghana Lands Commission reviews and decides your identity status. Expect email updates within ${VERIFICATION_HOURS_RANGE}.`;

/** Landowner / seller: identity first, then land documents to Lands Commission (per listing). */
export const SIGNUP_TIMELINE_LANDOWNER = `As a landowner or seller, verification happens in two stages — in order: (1) After login, complete Ghana Card verification first (identity). (2) Then add land documentation — when you register each parcel, uploads go to Ghana Lands Commission for document review and permission to list. Expect updates within ${VERIFICATION_HOURS_RANGE}.`;

/** Accredited arbitrator: neutral dispute resolution; no buyer/seller Ghana Card queue. */
export const SIGNUP_TIMELINE_ARBITRATOR = `As an accredited arbitrator you are a neutral party: you review disputes, evidence, and registry flags when cases are assigned. You do not use the buyer or seller Ghana Card onboarding path. Ghana Lands Commission may confirm your panel affiliation and registration number. Any credential checks typically complete within ${VERIFICATION_HOURS_RANGE}.`;

export const SIGNUP_PENDING_DESCRIPTION = `Your account is pending verification. ${VERIFICATION_TIMELINE_SUMMARY}`;

export const GHANA_CARD_SUBMITTED_DESCRIPTION = `We have received your Ghana Card details for screening. ${VERIFICATION_TIMELINE_SUMMARY}`;
