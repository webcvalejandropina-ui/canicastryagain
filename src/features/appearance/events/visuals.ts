import type { EventEffect } from './calendar';
import type { WorldMotif } from '../worlds';
export const EFFECT_MOTIFS: Record<EventEffect,readonly WorldMotif[]> = {
  fair:['lantern','confetti'],none:[],confetti:['gift','confetti'],floral:['flower','petal'],fire:['flame','spark'],ribbon:['ribbon','confetti'],
};
