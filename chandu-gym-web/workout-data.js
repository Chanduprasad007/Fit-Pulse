export const STORAGE_KEY = "chandu-gym-coach-state-v1";
export const DAY_ORDER = ["A", "B", "C", "D", "E"];

export const TRAINING_PHASES = [
  {
    id: "foundation",
    name: "Foundation",
    minSessions: 0,
    summary: "Own the movement patterns and build repeatable form.",
  },
  {
    id: "build",
    name: "Build",
    minSessions: 6,
    summary: "Push load steadily and unlock more accessories.",
  },
  {
    id: "performance",
    name: "Performance",
    minSessions: 14,
    summary: "Hold high-quality volume and chase heavier top sets.",
  },
];

export const PROGRAM = {
  A: {
    label: "Day A",
    title: "Chest + Triceps",
    focus: "Chest mass and tricep thickness",
    goal: "Build pressing strength and fuller triceps without junk volume.",
    exercises: [
      { id: "bench-press", name: "Barbell Bench Press", sets: 4, repMin: 6, repMax: 8, rest: "90s", cue: "Retract shoulder blades and keep the bar path low on the chest.", loadTrack: true, muscleGroup: "upper", progression: "compound" },
      { id: "incline-db-press", name: "Incline Dumbbell Press", sets: 3, repMin: 8, repMax: 10, rest: "75s", cue: "Use a 30-45 degree bench and own the descent.", loadTrack: true, muscleGroup: "upper", progression: "compound" },
      { id: "cable-fly", name: "Cable Fly", sets: 3, repMin: 12, repMax: 15, rest: "60s", cue: "Soft elbows, chest high, hard squeeze in the middle.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
      { id: "pushdown", name: "Tricep Cable Pushdown", sets: 4, repMin: 10, repMax: 12, rest: "60s", cue: "Pin elbows to your sides and fully lock out.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
      { id: "skull-crusher", name: "Skull Crushers", sets: 3, repMin: 10, repMax: 12, rest: "60s", cue: "Control the lowering phase and keep upper arms stacked.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
    ],
    evolutions: [
      { threshold: 2, exercise: { id: "machine-chest-press", name: "Machine Chest Press", sets: 2, repMin: 12, repMax: 15, rest: "60s", cue: "Drive the chest through the pad and chase a clean pump.", loadTrack: true, muscleGroup: "upper", progression: "accessory" } },
      { threshold: 4, exercise: { id: "overhead-tricep-extension", name: "Overhead Rope Tricep Extension", sets: 2, repMin: 14, repMax: 16, rest: "45s", cue: "Let the long head stretch fully before extending.", loadTrack: true, muscleGroup: "upper", progression: "accessory" } },
    ],
  },
  B: {
    label: "Day B",
    title: "Back + Biceps",
    focus: "Wide lats, thick back, and bigger arms",
    goal: "Own your pull-ups and build dense rowing strength.",
    exercises: [
      { id: "pull-up", name: "Pull-Ups / Assisted Pull-Ups", sets: 4, repMin: 6, repMax: 10, rest: "90s", cue: "Full hang, chest up, pull elbows to the ribs.", loadTrack: true, muscleGroup: "upper", progression: "compound" },
      { id: "barbell-row", name: "Barbell Row", sets: 4, repMin: 6, repMax: 8, rest: "90s", cue: "Stay hinged and pull to the lower chest or navel.", loadTrack: true, muscleGroup: "upper", progression: "compound" },
      { id: "seated-row", name: "Seated Cable Row", sets: 3, repMin: 10, repMax: 12, rest: "60s", cue: "Tall chest and a hard squeeze at the finish.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
      { id: "dumbbell-curl", name: "Dumbbell Curl", sets: 3, repMin: 10, repMax: 12, rest: "60s", cue: "Supinate hard and keep the ribs down.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
      { id: "hammer-curl", name: "Hammer Curl", sets: 3, repMin: 12, repMax: 12, rest: "60s", cue: "Drive the thumb up and keep shoulders quiet.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
    ],
    evolutions: [
      { threshold: 2, exercise: { id: "lat-prayer", name: "Straight-Arm Lat Prayer", sets: 2, repMin: 12, repMax: 15, rest: "45s", cue: "Think elbows to pockets and keep ribs stacked.", loadTrack: true, muscleGroup: "upper", progression: "accessory" } },
      { threshold: 4, exercise: { id: "incline-curl", name: "Incline Dumbbell Curl", sets: 2, repMin: 12, repMax: 15, rest: "45s", cue: "Keep elbows drifting behind the torso for a full stretch.", loadTrack: true, muscleGroup: "upper", progression: "accessory" } },
    ],
  },
  C: {
    label: "Day C",
    title: "Shoulders + Abs",
    focus: "Wide delts and resilient core strength",
    goal: "Bring up side delts and keep presses crisp without shoulder irritation.",
    exercises: [
      { id: "overhead-press", name: "Overhead Press", sets: 4, repMin: 6, repMax: 8, rest: "90s", cue: "Press in a straight line and squeeze glutes through the lockout.", loadTrack: true, muscleGroup: "upper", progression: "compound" },
      { id: "lateral-raise", name: "Lateral Raise", sets: 4, repMin: 12, repMax: 15, rest: "60s", cue: "Lead with elbows and stop before traps dominate.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
      { id: "face-pull", name: "Face Pull", sets: 3, repMin: 15, repMax: 15, rest: "60s", cue: "Pull to eye level and rotate thumbs behind you.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
      { id: "arnold-press", name: "Arnold Press", sets: 3, repMin: 10, repMax: 12, rest: "60s", cue: "Rotate smoothly and never bounce out of the bottom.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
      { id: "plank", name: "Plank", sets: 3, repMin: 45, repMax: 60, rest: "45s", cue: "Stack ribs over pelvis and squeeze glutes hard.", loadTrack: false, muscleGroup: "core", progression: "bodyweight", metric: "seconds" },
    ],
    evolutions: [
      { threshold: 2, exercise: { id: "lean-away-lateral", name: "Lean-Away Cable Lateral Raise", sets: 2, repMin: 12, repMax: 15, rest: "45s", cue: "Use a smooth arc and let the cable keep tension alive.", loadTrack: true, muscleGroup: "upper", progression: "accessory" } },
      { threshold: 4, exercise: { id: "knee-raise", name: "Hanging Knee Raise", sets: 3, repMin: 10, repMax: 15, rest: "45s", cue: "Posterior tilt first, then raise the knees.", loadTrack: false, muscleGroup: "core", progression: "bodyweight" } },
    ],
  },
  D: {
    label: "Day D",
    title: "Legs + Glutes",
    focus: "Leg size, strength, and glute power",
    goal: "Build a stronger base and keep hamstrings active instead of just surviving leg day.",
    exercises: [
      { id: "barbell-squat", name: "Barbell Squat", sets: 4, repMin: 6, repMax: 8, rest: "2m", cue: "Brace hard, screw feet into the floor, and drive out of the hole.", loadTrack: true, muscleGroup: "lower", progression: "compound" },
      { id: "leg-press", name: "Leg Press", sets: 3, repMin: 10, repMax: 12, rest: "90s", cue: "Use a full safe range without low-back rounding.", loadTrack: true, muscleGroup: "lower", progression: "compound" },
      { id: "rdl", name: "Romanian Deadlift", sets: 3, repMin: 10, repMax: 10, rest: "90s", cue: "Push hips back and keep the lats tight.", loadTrack: true, muscleGroup: "lower", progression: "compound" },
      { id: "leg-curl", name: "Leg Curl", sets: 3, repMin: 12, repMax: 12, rest: "60s", cue: "Curl hard and pause for a beat at the top.", loadTrack: true, muscleGroup: "lower", progression: "accessory" },
      { id: "calf-raise", name: "Calf Raise", sets: 4, repMin: 15, repMax: 20, rest: "45s", cue: "Long stretch at the bottom and an honest pause up top.", loadTrack: true, muscleGroup: "lower", progression: "accessory" },
    ],
    evolutions: [
      { threshold: 2, exercise: { id: "bulgarian-split-squat", name: "Bulgarian Split Squat", sets: 2, repMin: 10, repMax: 12, rest: "60s", cue: "Long stride, knee tracks over mid-foot, stay upright.", loadTrack: true, muscleGroup: "lower", progression: "accessory" } },
      { threshold: 4, exercise: { id: "hip-thrust", name: "Barbell Hip Thrust", sets: 3, repMin: 8, repMax: 10, rest: "75s", cue: "Posterior tilt at lockout and keep the chin tucked.", loadTrack: true, muscleGroup: "lower", progression: "compound" } },
    ],
  },
  E: {
    label: "Day E",
    title: "Back Focus + Rear Delts",
    focus: "Back depth, posture, and rear delt width",
    goal: "Strengthen the hinge and build posture-friendly upper back density.",
    exercises: [
      { id: "deadlift", name: "Deadlift", sets: 4, repMin: 5, repMax: 5, rest: "2m", cue: "Brace before the pull and keep the bar glued to you.", loadTrack: true, muscleGroup: "lower", progression: "compound" },
      { id: "wide-pull-up", name: "Wide-Grip Pull-Up / Lat Pulldown", sets: 4, repMin: 6, repMax: 10, rest: "90s", cue: "Start with a full hang and drive elbows down.", loadTrack: true, muscleGroup: "upper", progression: "compound" },
      { id: "rear-barbell-row", name: "Barbell Row", sets: 3, repMin: 8, repMax: 8, rest: "90s", cue: "Stay tight and lead with elbows, not wrists.", loadTrack: true, muscleGroup: "upper", progression: "compound" },
      { id: "rear-face-pull", name: "Face Pull", sets: 4, repMin: 15, repMax: 15, rest: "60s", cue: "Finish in a double-biceps shape.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
      { id: "rear-delt-fly", name: "Rear Delt Fly", sets: 3, repMin: 15, repMax: 15, rest: "60s", cue: "Lead with pinkies and squeeze at shoulder height.", loadTrack: true, muscleGroup: "upper", progression: "accessory" },
    ],
    evolutions: [
      { threshold: 2, exercise: { id: "chest-supported-row", name: "Chest-Supported Row", sets: 2, repMin: 10, repMax: 12, rest: "60s", cue: "Let the bench save your lower back and chase the squeeze.", loadTrack: true, muscleGroup: "upper", progression: "compound" } },
      { threshold: 4, exercise: { id: "reverse-pec-deck", name: "Reverse Pec Deck", sets: 2, repMin: 15, repMax: 18, rest: "45s", cue: "Stay long through the neck and move from the rear delts.", loadTrack: true, muscleGroup: "upper", progression: "accessory" } },
    ],
  },
};

export function createInitialState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      upperIncrementKg: 2.5,
      lowerIncrementKg: 5,
    },
    exerciseStates: {},
    sessions: [],
  };
}
