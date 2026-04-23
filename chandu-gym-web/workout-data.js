const workoutPlan = [
  // === DAY 1 ===
  {
    day: "Day 1",
    label: "CHEST + TRICEPS",
    type: "PUSH A",
    exercises: [
      { name: "Flat Barbell Bench Press", sets: 4, reps: "6-8", cue: "Primary compound — drive through chest" },
      { name: "Incline Dumbbell Press", sets: 3, reps: "8-10", cue: "Upper chest focus, control the descent" },
      { name: "Chest Flyes (Cable/DB)", sets: 3, reps: "12", cue: "Full stretch at bottom, squeeze at top" },
      { name: "Dips (weighted if possible)", sets: 3, reps: "10-12", cue: "Lean forward slightly to hit lower chest" },
      // Triceps
      { name: "Overhead Tricep Extension", sets: 3, reps: "10-12", cue: "Long head emphasis, full range of motion" },
      { name: "Tricep Pushdowns (rope)", sets: 3, reps: "12-15", cue: "Flare wrists out at bottom" },
      { name: "Close-Grip Bench Press", sets: 3, reps: "10", cue: "Keep elbows tucked in tight" },
      // Abs Finisher
      { name: "Hanging Leg Raises", sets: 3, reps: "12-15", cue: "Control the swing, no momentum" },
      { name: "Plank", sets: 3, reps: "45-60 sec", cue: "Brace core, don’t let hips drop" }
    ]
  },

  // === DAY 2 ===
  {
    day: "Day 2",
    label: "BACK + BICEPS",
    type: "PULL A",
    exercises: [
      // Back
      { name: "Deadlifts", sets: 4, reps: "5-6", cue: "Hip hinge, don’t round lower back" },
      { name: "Lat Pulldowns (wide grip)", sets: 3, reps: "10-12", cue: "Pull to upper chest, squeeze lats" },
      { name: "Barbell Rows", sets: 3, reps: "8-10", cue: "To belly button, about 1” pull back" },
      { name: "Seated Cable Row", sets: 3, reps: "12", cue: "Full stretch forward, pull hard back" },
      { name: "Dumbbell Pullover", sets: 2, reps: "12", cue: "Great for lat width, keep arms straight" },
      // Biceps
      { name: "Barbell / EZ Bar Curls", sets: 3, reps: "10", cue: "No swinging, slow and controlled" },
      { name: "Hammer Curls", sets: 3, reps: "12", cue: "Brachialis growth, adds arm thickness" }
    ]
  },

  // === DAY 3 ===
  {
    day: "Day 3",
    label: "LEGS + SHOULDERS",
    type: "LOWER + DELTS A",
    exercises: [
      // Legs
      { name: "Front Squat / Back Squat", sets: 4, reps: "6-8", cue: "Depth is parallel or below, knees track" },
      { name: "Walking Lunges", sets: 3, reps: "10 reps/leg", cue: "Keep torso upright, step wide" },
      { name: "Leg Press", sets: 3, reps: "10-12", cue: "Don’t lock knees at top" },
      { name: "Standing Calf Raises", sets: 4, reps: "15-20", cue: "Full stretch at bottom, pause at top" },
      // Shoulders
      { name: "Overhead Barbell Press", sets: 3, reps: "8-10", cue: "Compound mass builder for all 3 delt heads" },
      { name: "Lateral Raises", sets: 3, reps: "12", cue: "Lead with elbow, slight forward lean" },
      { name: "Front Raises", sets: 3, reps: "12", cue: "Alternate arms, control the lowering" },
      { name: "Barbell Shrugs", sets: 3, reps: "12-15", cue: "Hold at top, squeeze traps hard" }
    ]
  },

  // === DAY 4 ===
  {
    day: "Day 4",
    label: "CHEST + TRICEPS",
    type: "PUSH B",
    exercises: [
      // Chest
      { name: "Dumbbell Bench Press", sets: 4, reps: "8-10", cue: "Greater range than barbell, ensure stability" },
      { name: "Decline Bench Press", sets: 3, reps: "8-10", cue: "Lower chest emphasis, feet secured" },
      { name: "Pec Deck / Machine Flye", sets: 3, reps: "12-15", cue: "Squeeze at contraction, control rhythm" },
      { name: "Cable Crossovers", sets: 3, reps: "15", cue: "Arms wide, cross hands at bottom" },
      // Triceps
      { name: "Skull Crushers (EZ bar)", sets: 3, reps: "10-12", cue: "Lower to forehead, keep elbows fixed" },
      { name: "Tricep Kickbacks", sets: 3, reps: "12", cue: "Full extension, elbow above torso" },
      { name: "Bodyweight Dips", sets: 3, reps: "to failure", cue: "Incline torso for triceps focus" }
    ]
  },

  // === DAY 5 ===
  {
    day: "Day 5",
    label: "BACK + BICEPS",
    type: "PULL B",
    exercises: [
      // Back
      { name: "Pull-Ups / Assisted Pull-Ups", sets: 4, reps: "6-10", cue: "Best with extra weight, work up to bodyweight" },
      { name: "T-Bar Rows", sets: 3, reps: "8-10", cue: "Mid-back thickness, squeeze hard at top" },
      { name: "Lat Pulldown (close grip)", sets: 3, reps: "12-15", cue: "Different angle vs wide grip" },
      { name: "Wide-Grip Cable Row", sets: 3, reps: "10-12", cue: "Rear delt activation and mid range" },
      // Biceps
      { name: "Incline Dumbbell Curls", sets: 3, reps: "10-12", cue: "Stretches long head, great peak builder" },
      { name: "Preacher Curls", sets: 3, reps: "10-12", cue: "Eliminates cheating, strict form only" },
      { name: "Cable Curls", sets: 3, reps: "12-15", cue: "Constant tension throughout movement" },
      // Abs Finisher
      { name: "Hanging Knee Raises", sets: 3, reps: "15", cue: "Progress to full leg raises over time" },
      { name: "Ab Wheel Rollout", sets: 3, reps: "8-10", cue: "Incredible for deep core strength" }
    ]
  },

  // === DAY 6 ===
  {
    day: "Day 6",
    label: "SHOULDERS + LEGS",
    type: "UPPER + LOWER B",
    exercises: [
      // Shoulders
      { name: "Military Press (seated)", sets: 4, reps: "6-8", cue: "Biggest shoulder mass builder" },
      { name: "Arnold Press", sets: 3, reps: "10", cue: "Full rotation, hits all 3 delt heads" },
      { name: "Side Lateral Raises", sets: 3, reps: "12", cue: "Critical for wide shoulders" },
      { name: "Face Pulls (cable)", sets: 3, reps: "15", cue: "Rear delt + rotator cuff health" },
      // Legs
      { name: "Back Squats", sets: 4, reps: "8-12", cue: "Full depth, opposite focus from Day 3" },
      { name: "Seated Leg Extension", sets: 3, reps: "15", cue: "VMO/quad isolation" },
      { name: "Lying Leg Curls", sets: 3, reps: "12", cue: "Hit hamstring contraction" },
      { name: "Seated Calf Raises", sets: 4, reps: "15-20", cue: "Soleus focused, different from standing" }
    ]
  },

  // === ABS DEDICATED BLOCKS & TIPS ===
  {
    day: "Abs - Dedicated Block",
    label: "Abs Only",
    exercises: [
      { name: "Weighted Plank", sets: 3, reps: "45-60 sec", cue: "Add plate on back when comfortable" },
      { name: "Cable Crunches", sets: 3, reps: "15", cue: "Heaviest abs movement, add load weekly" },
      { name: "Flat Bench Leg Raises", sets: 3, reps: "15", cue: "Lower abs focus, control the lowering" },
      { name: "Side Plank", sets: "2 sets/side", reps: "30-45 sec", cue: "Oblique stability and definition" }
    ]
  },
  {
    day: "Abs - Finisher Block",
    label: "Abs Finisher",
    exercises: [
      { name: "Decline Sit-Ups", sets: 3, reps: "15", cue: "Add weight on chest as you progress" },
      { name: "Russian Twists", sets: 3, reps: "20", cue: "Feel oblique for extra challenge" },
      { name: "Cable Crunches", sets: 3, reps: "15", cue: "From the spine, don’t just pull down" },
      { name: "Bicycle Crunches", sets: 3, reps: "20", cue: "Slow and deliberate, full twist" }
    ]
  }
];

// Optional: Helpful program notes
const programNotes = {
  progressiveOverload: "Add 2.5-5kg when you hit top of rep range 2 sessions in a row",
  warmup: "5-10 min cardio + 2 lighter sets on first compound lift",
  nutrition: "300-500 kcal surplus. Nakpro whey post-workout. Creatine 5g daily.",
  sleep: "7-8 hours non-negotiable. Muscle is built during recovery."
};

export { workoutPlan, programNotes };
