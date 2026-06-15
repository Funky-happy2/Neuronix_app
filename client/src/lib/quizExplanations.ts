// Kid-friendly, scientifically-accurate explanations keyed by question text.
// Shown after each Speed Quiz answer so players learn *why* an answer is right —
// not just whether they got it. Keep explanations short, encouraging, and correct.
export const QUIZ_EXPLANATIONS: Record<string, string> = {
  // Year 3
  "What do plants need to grow?": "Plants use sunlight and water (plus air) to make their own food.",
  "Which animal lays eggs?": "Birds like chickens lay eggs; dogs, cats and horses give birth to live babies.",
  "What do we use our lungs for?": "Lungs take in oxygen and breathe out carbon dioxide.",
  "What colour is the sky on a sunny day?": "Sunlight scatters in the air, and blue light scatters most, so the sky looks blue.",
  "Which part of a plant grows underground?": "Roots grow down to soak up water and hold the plant in place.",
  "What is rain made of?": "Rain is droplets of water that fall from clouds.",
  "How many legs does a dog have?": "Dogs are four-legged animals.",
  "Which season is the hottest?": "Summer is the warmest season because the Sun is highest in the sky.",
  "What do caterpillars turn into?": "Caterpillars change into butterflies in a process called metamorphosis.",
  "Where does the Sun go at night?": "The Sun stays put — Earth spins, so your side turns away into night.",
  // Year 4
  "What planet do we live on?": "We live on Earth, the third planet from the Sun.",
  "What is the biggest animal on Earth?": "The blue whale is the largest animal ever — bigger even than the dinosaurs.",
  "What do bees make?": "Bees turn flower nectar into honey.",
  "How many legs does a spider have?": "Spiders are arachnids and have eight legs (insects have six).",
  "What keeps us stuck to the ground?": "Gravity pulls everything toward the centre of the Earth.",
  "Which is NOT a state of matter?": "Solid, liquid and gas are states of matter — energy is not.",
  "What organ pumps blood around your body?": "The heart pumps blood all around your body.",
  "What do we call a baby frog?": "Baby frogs are tadpoles and live in water before growing legs.",
  "Which material is magnetic?": "Iron is magnetic; wood, plastic and paper are not.",
  "What is the Sun?": "The Sun is a star — a giant ball of hot, glowing gas.",
  // Year 5
  "What gas do plants breathe in?": "Plants take in carbon dioxide and release oxygen during photosynthesis.",
  "What is H2O?": "H₂O is the chemical formula for water: two hydrogen atoms and one oxygen atom.",
  "Which planet is closest to the Sun?": "Mercury is the closest planet to the Sun.",
  "What force keeps us on the ground?": "Gravity is the force pulling us toward Earth.",
  "Which state of matter is ice?": "Ice is frozen water — a solid.",
  "How many planets are in our solar system?": "There are 8 planets, since Pluto was reclassified as a dwarf planet.",
  "What do plants make during photosynthesis?": "Photosynthesis makes food (sugar) for the plant and releases oxygen.",
  "What is the hardest natural material?": "Diamond is the hardest natural material on Earth.",
  "Which part of the body controls thinking?": "The brain controls thinking, memory and your whole body.",
  "What causes day and night?": "Earth spins once a day, turning us toward and away from the Sun.",
  // Year 6
  "What is the boiling point of water?": "Water boils at 100°C at sea level.",
  "What gas do we breathe out?": "We breathe in oxygen and breathe out carbon dioxide.",
  "Which organ controls your body?": "The brain sends signals that control everything you do.",
  "What type of rock forms from lava?": "Igneous rock forms when molten lava or magma cools and hardens.",
  "What is the largest organ in the body?": "Skin is your largest organ — it protects everything inside.",
  "What is the chemical symbol for oxygen?": "Oxygen's symbol is O (O₂ is a molecule of two oxygen atoms).",
  "Sound travels fastest through which material?": "Sound travels fastest through solids because their particles are packed tightly.",
  "What gives plants their green colour?": "Chlorophyll is the green pigment that captures sunlight.",
  "What is the freezing point of water?": "Water freezes into ice at 0°C.",
  "Which planet is known as the Red Planet?": "Mars looks red because of rusty iron in its soil.",
  // Year 7
  "Symbol 'Fe' is which element?": "Fe comes from 'ferrum', the Latin word for iron.",
  "Symbol 'Au' is which element?": "Au comes from 'aurum', Latin for gold.",
  "Symbol 'Na' is which element?": "Na comes from 'natrium', the Latin name for sodium.",
  "Symbol 'Hg' is which element?": "Hg comes from 'hydrargyrum', meaning liquid silver.",
  "Atomic number 1 is?": "Hydrogen has 1 proton, making it element number 1.",
  "Symbol 'K' is which element?": "K comes from 'kalium', the Latin name for potassium.",
  "Which is a noble gas?": "Neon is a noble gas — it almost never reacts with other elements.",
  "Lightest element?": "Hydrogen is the lightest and most common element in the universe.",
  "What is photosynthesis?": "Photosynthesis is how plants turn sunlight, water and CO₂ into food.",
  "What particle has a negative charge?": "Electrons carry a negative charge; protons are positive and neutrons are neutral.",
  // Year 8
  "What is the pH of a neutral solution?": "A neutral solution like pure water has a pH of 7.",
  "What is the powerhouse of the cell?": "Mitochondria release energy for the cell — that's why they're its powerhouse.",
  "What is Newton's first law about?": "Newton's first law: objects keep doing what they're doing unless a force acts — that's inertia.",
  "What is an isotope?": "Isotopes are atoms of the same element with different numbers of neutrons.",
  "What type of wave is sound?": "Sound is a longitudinal wave — particles vibrate back and forth along its direction of travel.",
  "What is the formula for speed?": "Speed = distance ÷ time.",
  "What bonds share electrons?": "Covalent bonds form when atoms share electrons.",
  "DNA stands for?": "DNA stands for deoxyribonucleic acid, the molecule carrying your genes.",
  "What is the unit of force?": "Force is measured in newtons (N).",
  "Which gas makes up most of our atmosphere?": "About 78% of the air around us is nitrogen.",
  // Year 3 (added)
  "What do we call frozen water?": "Frozen water is ice — water in its solid state.",
  "Which animal can fly?": "Birds have wings and can fly.",
  "Which sense do we use our nose for?": "We use our nose to smell.",
  "What do cows give us to drink?": "Cows give us milk.",
  "How many legs does an insect have?": "Insects have six legs (spiders have eight and aren't insects).",
  // Year 4 (added)
  "What do we call animals that eat only plants?": "Animals that eat only plants are herbivores.",
  "Which planet is famous for its rings?": "Saturn is famous for its bright rings of ice and rock.",
  "What gas do we need to breathe in?": "We breathe in oxygen to stay alive.",
  "Which part of a plant makes seeds?": "Flowers make seeds that can grow into new plants.",
  "What is the closest star to Earth?": "The Sun is the closest star to Earth.",
  // Year 5 (added)
  "What do we call animals with a backbone?": "Animals with a backbone are called vertebrates.",
  "Which force slows down a sliding object?": "Friction is the force that slows things rubbing together.",
  "How long does Earth take to orbit the Sun?": "Earth takes about one year to travel once around the Sun.",
  "What do we call water turning into a gas?": "When water turns into vapour, that's evaporation.",
  "Which organ do fish use to breathe?": "Fish use gills to take oxygen out of water.",
  // Year 6 (added)
  "What do we call molten rock under the ground?": "Molten rock below the surface is magma; above ground it's called lava.",
  "Which blood cells fight infection?": "White blood cells defend your body against germs.",
  "Which planet is the largest?": "Jupiter is the largest planet in our solar system.",
  "What is a group of the same atoms called?": "A substance made of only one kind of atom is an element.",
  "What do we call the path a planet takes around the Sun?": "A planet's path around the Sun is its orbit.",
  // Year 7 (added)
  "What is the charge of a neutron?": "Neutrons have no charge — they are neutral.",
  "Which organ filters waste from your blood?": "Kidneys filter waste out of your blood to make urine.",
  "What type of energy does a moving object have?": "Moving objects have kinetic energy.",
  "Which planet appears to spin on its side?": "Uranus is tilted so far it appears to spin on its side.",
  "What is the chemical formula for table salt?": "Table salt is sodium chloride, NaCl.",
  // Year 8 (added)
  "What is the SI unit of energy?": "Energy is measured in joules (J).",
  "Which subatomic particle decides which element an atom is?": "The number of protons (the atomic number) decides which element an atom is.",
  "What is Newton's second law?": "Newton's second law: force equals mass times acceleration (F = ma).",
  "How do plants lose water through their leaves?": "Plants lose water vapour through their leaves in a process called transpiration.",
  "What does Ohm's law state?": "Ohm's law links voltage, current and resistance: V = I × R.",
  // Year 9 (challenge tier)
  "What is the acceleration due to gravity on Earth?": "Near Earth's surface, gravity speeds objects up at about 9.8 m/s².",
  "What pH range do acids have?": "Acids have a pH below 7; bases (alkalis) are above 7.",
  "What is the chemical formula for carbon dioxide?": "Carbon dioxide is one carbon atom and two oxygen atoms: CO₂.",
  "Which molecule stores energy for use in cells?": "Cells store and release energy using a molecule called ATP.",
  "Which law says energy cannot be created or destroyed?": "The law of conservation of energy says energy only changes form — it's never created or destroyed.",
  "What is the unit of frequency?": "Frequency is measured in hertz (Hz) — cycles per second.",
  "What kind of reaction releases heat?": "Exothermic reactions release heat to their surroundings.",
  "Which group contains the most reactive metals?": "Group 1 alkali metals (like sodium) are the most reactive metals.",
  "What force holds the nucleus of an atom together?": "The strong nuclear force binds protons and neutrons together in the nucleus.",
  "What is the speed of light in a vacuum?": "Light travels about 300,000 kilometres every second.",
};

// Returns a teaching explanation for a question, falling back to simply naming
// the correct answer so the player always learns the right one.
export function getQuizExplanation(question: string, answer: string): string {
  return QUIZ_EXPLANATIONS[question] || `The correct answer is "${answer}".`;
}
