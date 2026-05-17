export interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export const ALL_QUESTIONS: Record<string, Question[]> = {
  "gravity-dash": [
    { question: "Which planet has the strongest gravity?", options: ["Mars", "Earth", "Jupiter", "Moon"], correct: 2, explanation: "Jupiter is the largest planet and has gravity 2.4x stronger than Earth!" },
    { question: "On the Moon, you would weigh...", options: ["More", "The same", "About 1/6 of Earth weight", "Nothing"], correct: 2, explanation: "The Moon's gravity is about 1/6 of Earth's!" },
    { question: "What determines a planet's gravity?", options: ["Color", "Distance from sun", "Mass and size", "Temperature"], correct: 2, explanation: "Gravity depends on mass and radius!" },
    { question: "Where would you jump highest?", options: ["Earth", "Mars", "Moon", "Jupiter"], correct: 2, explanation: "The Moon has the weakest gravity of these options!" },
    { question: "Gravity pulls objects toward the...", options: ["Sky", "Center of mass", "Equator", "North pole"], correct: 1, explanation: "Gravity pulls everything toward the center of mass!" },
    { question: "What keeps the Moon orbiting Earth?", options: ["Magnets", "Gravity", "Wind", "Light"], correct: 1, explanation: "Gravity keeps the Moon locked in orbit around Earth!" },
  ],
  "dna-decoder": [
    { question: "Adenine (A) always pairs with...", options: ["Guanine", "Cytosine", "Thymine", "Adenine"], correct: 2, explanation: "A-T is one of the two base pairs in DNA!" },
    { question: "Guanine (G) always pairs with...", options: ["Thymine", "Adenine", "Cytosine", "Guanine"], correct: 2, explanation: "G-C is the other base pair in DNA!" },
    { question: "What shape is DNA?", options: ["Circle", "Square", "Double helix", "Triangle"], correct: 2, explanation: "DNA is a famous double helix shape!" },
    { question: "DNA stands for...", options: ["Digital Nano Acid", "Deoxyribonucleic Acid", "Double Nucleic Acid", "Dynamic Natural Acid"], correct: 1, explanation: "Deoxyribonucleic Acid is the full name!" },
    { question: "Where is DNA found in cells?", options: ["Cell wall", "Nucleus", "Membrane", "Outside"], correct: 1, explanation: "DNA lives in the nucleus of cells!" },
    { question: "How many chromosomes do humans have?", options: ["23", "46", "64", "12"], correct: 1, explanation: "Humans have 46 chromosomes (23 pairs)!" },
  ],
  "circuit-crafter": [
    { question: "What flows through a circuit?", options: ["Water", "Air", "Electric current", "Light"], correct: 2, explanation: "Electric current (electrons) flows through circuits!" },
    { question: "A circuit must be ___ for current to flow.", options: ["Open", "Closed/Complete", "Broken", "Empty"], correct: 1, explanation: "Current can only flow in a complete, closed circuit!" },
    { question: "In a series circuit, if one bulb breaks...", options: ["Others get brighter", "All go out", "Nothing happens", "Battery explodes"], correct: 1, explanation: "In series, breaking one part stops all current flow!" },
    { question: "What unit measures electric current?", options: ["Volts", "Watts", "Amperes", "Ohms"], correct: 2, explanation: "Current is measured in Amperes (Amps)!" },
    { question: "Batteries provide the ___ in a circuit.", options: ["Resistance", "Voltage", "Weight", "Color"], correct: 1, explanation: "Batteries provide voltage - the 'push' for electrons!" },
    { question: "A switch in a circuit controls...", options: ["Volume", "Current flow", "Color", "Heat"], correct: 1, explanation: "Switches open/close the circuit to control current!" },
  ],
  "chemistry-mixer": [
    { question: "Mixing baking soda and vinegar creates...", options: ["Nothing", "CO2 gas bubbles", "Gold", "Ice"], correct: 1, explanation: "This famous reaction produces carbon dioxide gas!" },
    { question: "Water's chemical formula is...", options: ["CO2", "H2O", "O2", "NaCl"], correct: 1, explanation: "H2O means 2 hydrogen atoms + 1 oxygen atom!" },
    { question: "What does pH measure?", options: ["Temperature", "Weight", "Acidity/alkalinity", "Speed"], correct: 2, explanation: "pH tells us how acidic or basic a substance is!" },
    { question: "Rust is caused by iron reacting with...", options: ["Sugar", "Oxygen and water", "Plastic", "Sound"], correct: 1, explanation: "Iron + oxygen + water = iron oxide (rust)!" },
    { question: "Salt's chemical name is...", options: ["Carbon dioxide", "Sodium chloride", "Hydrogen", "Calcium"], correct: 1, explanation: "Table salt is sodium chloride (NaCl)!" },
    { question: "A chemical change is different from physical because...", options: ["It's bigger", "New substances form", "It's slower", "It costs more"], correct: 1, explanation: "Chemical changes create entirely new substances!" },
  ],
  "time-travel-scientist": [
    { question: "Who discovered gravity watching an apple fall?", options: ["Einstein", "Newton", "Galileo", "Darwin"], correct: 1, explanation: "Isaac Newton famously observed a falling apple!" },
    { question: "Who proposed the theory of evolution?", options: ["Newton", "Einstein", "Darwin", "Curie"], correct: 2, explanation: "Charles Darwin proposed natural selection!" },
    { question: "Marie Curie discovered...", options: ["Gravity", "Radioactivity", "Electricity", "DNA"], correct: 1, explanation: "Marie Curie pioneered research on radioactivity!" },
    { question: "The first telescope was used by...", options: ["Darwin", "Curie", "Galileo", "Newton"], correct: 2, explanation: "Galileo first used telescopes to study the sky!" },
    { question: "Who developed the theory of relativity?", options: ["Newton", "Einstein", "Hawking", "Bohr"], correct: 1, explanation: "Albert Einstein published his theory of relativity!" },
    { question: "Thomas Edison invented the practical...", options: ["Telephone", "Light bulb", "Car", "Computer"], correct: 1, explanation: "Edison made the first commercially practical light bulb!" },
  ],
  "element-arena": [
    { question: "What is the lightest element?", options: ["Helium", "Hydrogen", "Oxygen", "Carbon"], correct: 1, explanation: "Hydrogen has just 1 proton - the lightest!" },
    { question: "Noble gases are special because they...", options: ["Glow in dark", "Don't react easily", "Are heavy", "Are liquid"], correct: 1, explanation: "Noble gases have full electron shells - very stable!" },
    { question: "Gold's chemical symbol is...", options: ["Go", "Gd", "Au", "Ag"], correct: 2, explanation: "Au comes from the Latin word 'aurum'!" },
    { question: "How many elements are in the periodic table?", options: ["50", "100", "118", "200"], correct: 2, explanation: "There are currently 118 confirmed elements!" },
    { question: "Iron's chemical symbol is...", options: ["Ir", "In", "Fe", "I"], correct: 2, explanation: "Fe comes from the Latin 'ferrum'!" },
    { question: "What element makes up most of Earth's atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon", "Helium"], correct: 1, explanation: "Nitrogen makes up about 78% of our atmosphere!" },
  ],
  "ecosystem-builder": [
    { question: "What do producers create?", options: ["Heat", "Food/Energy", "Water", "Soil"], correct: 1, explanation: "Producers (plants) create food through photosynthesis!" },
    { question: "A food chain starts with...", options: ["Predators", "Humans", "Producers/Plants", "Decomposers"], correct: 2, explanation: "Food chains always start with producers!" },
    { question: "What happens if predators disappear?", options: ["Nothing", "Prey overpopulates", "Plants die", "It rains more"], correct: 1, explanation: "Without predators, prey populations grow out of control!" },
    { question: "Decomposers help by...", options: ["Eating predators", "Breaking down dead matter", "Making rain", "Creating oxygen"], correct: 1, explanation: "Decomposers recycle nutrients back into the ecosystem!" },
    { question: "Biodiversity means...", options: ["Big animals", "Variety of life", "Deep oceans", "Hot weather"], correct: 1, explanation: "Biodiversity is the variety of different living things!" },
    { question: "Photosynthesis requires sunlight, water, and...", options: ["Soil", "CO2", "Wind", "Heat"], correct: 1, explanation: "Plants take in carbon dioxide and release oxygen!" },
  ],
  "physics-puzzle-rooms": [
    { question: "A lever helps you by...", options: ["Creating energy", "Multiplying force", "Making things lighter", "Stopping gravity"], correct: 1, explanation: "Levers multiply the force you apply!" },
    { question: "Energy cannot be ___ or ___.", options: ["Seen or heard", "Created or destroyed", "Hot or cold", "Fast or slow"], correct: 1, explanation: "Energy is always conserved - just transformed!" },
    { question: "Friction is a force that...", options: ["Speeds things up", "Creates gravity", "Slows things down", "Makes things lighter"], correct: 2, explanation: "Friction opposes motion and slows things down!" },
    { question: "A ramp is a type of...", options: ["Lever", "Simple machine", "Motor", "Battery"], correct: 1, explanation: "Ramps (inclined planes) are one of 6 simple machines!" },
    { question: "Magnets attract objects made of...", options: ["Wood", "Plastic", "Iron/Steel", "Glass"], correct: 2, explanation: "Magnets attract ferromagnetic materials like iron!" },
    { question: "Sound travels fastest through...", options: ["Air", "Water", "Solids", "Vacuum"], correct: 2, explanation: "Sound travels fastest through solids because particles are closest!" },
  ],
  "weather-commander": [
    { question: "Rain forms when water vapor...", options: ["Heats up", "Condenses", "Freezes instantly", "Evaporates more"], correct: 1, explanation: "Water vapor condenses into droplets that form rain!" },
    { question: "Low air pressure usually brings...", options: ["Sunny weather", "Stormy weather", "Snow only", "Earthquakes"], correct: 1, explanation: "Low pressure areas often bring clouds and storms!" },
    { question: "Thunder is caused by...", options: ["Clouds bumping", "Lightning heating air", "Wind speed", "Rain falling"], correct: 1, explanation: "Lightning superheats air, causing it to expand rapidly - BOOM!" },
    { question: "The water cycle includes evaporation, condensation, and...", options: ["Freezing", "Burning", "Precipitation", "Melting"], correct: 2, explanation: "Precipitation (rain/snow) completes the water cycle!" },
    { question: "Hurricanes form over...", options: ["Mountains", "Warm ocean water", "Deserts", "Cold land"], correct: 1, explanation: "Warm ocean water fuels hurricane formation!" },
    { question: "Tornadoes are measured using the...", options: ["Richter scale", "Fujita scale", "pH scale", "Kelvin scale"], correct: 1, explanation: "The Enhanced Fujita (EF) scale rates tornado intensity!" },
  ],
  "microbe-defender": [
    { question: "White blood cells help by...", options: ["Carrying oxygen", "Fighting germs", "Making bones", "Digesting food"], correct: 1, explanation: "White blood cells are your body's defenders!" },
    { question: "Vaccines work by...", options: ["Killing all germs", "Training your immune system", "Making you stronger", "Adding vitamins"], correct: 1, explanation: "Vaccines teach your immune system to recognize threats!" },
    { question: "Antibodies are shaped like the letter...", options: ["X", "O", "Y", "S"], correct: 2, explanation: "Antibodies have a Y-shape to grab onto germs!" },
    { question: "Your first line of defense against germs is...", options: ["Medicine", "Skin", "White blood cells", "Bones"], correct: 1, explanation: "Skin is a physical barrier keeping germs out!" },
    { question: "Bacteria are different from viruses because bacteria...", options: ["Are bigger", "Are living cells", "Don't exist", "Are invisible"], correct: 1, explanation: "Bacteria are living single-celled organisms!" },
    { question: "Washing hands helps prevent disease by...", options: ["Cooling skin", "Removing germs", "Adding vitamins", "Strengthening bones"], correct: 1, explanation: "Soap and water physically remove germs from your hands!" },
  ],
  "space-architect": [
    { question: "What provides oxygen on a space station?", options: ["Windows", "Electrolysis of water", "Trees", "Fans"], correct: 1, explanation: "Water is split into oxygen and hydrogen through electrolysis!" },
    { question: "Why do space stations orbit Earth?", options: ["Engines push them", "They're falling around Earth", "Magic", "Wind"], correct: 1, explanation: "Orbiting is actually free-falling around Earth continuously!" },
    { question: "Solar panels on a space station convert...", options: ["Wind to power", "Sunlight to electricity", "Heat to cold", "Water to fuel"], correct: 1, explanation: "Photovoltaic cells convert sunlight directly into electricity!" },
    { question: "In microgravity, flames are...", options: ["Taller", "Spherical", "Impossible", "Blue only"], correct: 1, explanation: "Without gravity, hot air doesn't rise - flames become spheres!" },
    { question: "The ISS travels at about...", options: ["100 mph", "1,000 mph", "17,500 mph", "Speed of light"], correct: 2, explanation: "The ISS zooms at 17,500 mph - orbiting Earth every 90 minutes!" },
    { question: "Astronauts exercise in space to prevent...", options: ["Boredom", "Muscle and bone loss", "Hunger", "Cold"], correct: 1, explanation: "Without gravity, muscles and bones weaken rapidly!" },
  ],
  "quantum-quest": [
    { question: "Light behaves as both a...", options: ["Solid and liquid", "Wave and particle", "Gas and plasma", "Sound and color"], correct: 1, explanation: "Wave-particle duality is one of quantum physics' biggest mysteries!" },
    { question: "An electron's position is...", options: ["Always exact", "Uncertain until measured", "Always the same", "Predictable"], correct: 1, explanation: "Heisenberg's uncertainty principle says we can't know both position and momentum!" },
    { question: "Quantum tunneling means particles can...", options: ["Grow bigger", "Pass through barriers", "Change color", "Stop moving"], correct: 1, explanation: "Particles can 'tunnel' through energy barriers they shouldn't be able to cross!" },
    { question: "What are quarks?", options: ["Stars", "Building blocks of protons", "Types of atoms", "Light waves"], correct: 1, explanation: "Quarks are the fundamental particles that make up protons and neutrons!" },
    { question: "Quantum entanglement links particles so that...", options: ["They merge", "Measuring one affects the other instantly", "They repel", "They disappear"], correct: 1, explanation: "Einstein called it 'spooky action at a distance'!" },
    { question: "Superposition means a particle can be...", options: ["Very big", "In two states at once", "Invisible", "Frozen"], correct: 1, explanation: "Until observed, quantum particles exist in multiple states simultaneously!" },
  ],
  "fossil-hunter": [
    { question: "Fossils form most commonly in...", options: ["Igneous rock", "Sedimentary rock", "Metamorphic rock", "Lava"], correct: 1, explanation: "Sedimentary rocks form in layers, perfect for trapping organisms!" },
    { question: "Carbon dating helps determine a fossil's...", options: ["Color", "Age", "Weight", "Species"], correct: 1, explanation: "Carbon-14 decay rate tells us how old organic remains are!" },
    { question: "The age of dinosaurs ended about...", options: ["1,000 years ago", "1 million years ago", "66 million years ago", "1 billion years ago"], correct: 2, explanation: "A massive asteroid impact 66 million years ago caused mass extinction!" },
    { question: "Amber can preserve...", options: ["Only rocks", "Insects perfectly", "Water", "Sounds"], correct: 1, explanation: "Tree resin hardens into amber, trapping insects in perfect detail!" },
    { question: "Index fossils help scientists...", options: ["Find gold", "Date rock layers", "Predict weather", "Make tools"], correct: 1, explanation: "Index fossils existed for short periods, so they mark specific time periods!" },
    { question: "The oldest fossils are about...", options: ["1 million years", "100 million years", "3.5 billion years", "100 years"], correct: 2, explanation: "The oldest fossils are stromatolites, about 3.5 billion years old!" },
  ],
};

export function getQuestionsForGame(gameId: string): Question[] {
  return ALL_QUESTIONS[gameId] || ALL_QUESTIONS["gravity-dash"];
}
