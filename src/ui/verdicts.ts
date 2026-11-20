/**
 * The line under the score card: a joke about how the move actually went. It looks at what never arrived
 * (fell off on the road, or never even got packed), what arrived broken, and what made it, and picks a joke
 * for the situation: a combination of losses if one fits, otherwise the dearest thing that went wrong,
 * otherwise how the whole run went. Picked at random from each set, so a second run reads differently.
 */

/** What became of each thing by the end of the trip. */
export interface Outcome {
  /** Keys of things that made it, in one piece. */
  delivered: string[];
  /** Keys of things that fell off on the way and were never claimed back. */
  lost: string[];
  /** Keys of things never packed at all: still at the old house. */
  left: string[];
  /** Keys of things that arrived broken. */
  broken: string[];
  /** 0 to 3. */
  stars: number;
}

type Lines = string[];

/**
 * For each thing: `gone` when it never arrived (fell off, or was never packed), `broken` when it arrived in
 * pieces.
 */
const ITEMS: Record<string, { gone: Lines; broken?: Lines }> = {
  cat: {
    gone: [
      'Biscuit is walking home. Biscuit will not forget this.',
      'Biscuit has been rehomed. Biscuit rehomed himself, to the neighbours, out of spite.',
      'Somewhere on the road, a cat is drafting a very long letter of complaint.',
      'Biscuit is fine. Biscuit has a new family now. They have a better truck.',
      'You moved house. Biscuit moved on.',
      'The new house is lovely. It is also, technically, cat-free. For now.',
      'Biscuit will be home in nine to ten business lives.',
      'Lost: one cat. Answers to "Biscuit", but will not answer to you.',
      'The cat was never really yours. You were his. And he has resigned.',
      'Biscuit is thumbing a lift. He has no thumbs. He will manage.',
      'Biscuit found his own way. It goes through your new kitchen window at 3 a.m.',
      'A cat can always find its way home. It has chosen not to.',
    ],
  },
  bird: {
    gone: [
      'Sunny flew the coop. Technically the coop flew off the truck.',
      'The canary is free. It has never been more terrified.',
      'Sunny is singing somewhere. It is not a happy song.',
      'Somewhere a canary is telling a pigeon about you.',
      'Sunny always wanted to see the world. Not like this.',
      'A small yellow bird is now the most interesting thing in a hedge.',
      'You are now a person who lost a bird. Say it out loud. Sit with it.',
      'Sunny went south for the winter. And the spring. And forever.',
      'The cage made it home. The bird has opinions about that.',
      'Sunny has joined a flock of sparrows. She is their leader now.',
    ],
  },
  fish: {
    gone: [
      'Goldie is in a better place. A puddle, but a better one.',
      'Somewhere on the road, a goldfish is having the adventure of a three-second lifetime.',
      'Goldie went to the sea. Goldie is a freshwater fish. Goldie is having a day.',
      'You will be getting a new fish. It will also be called Goldie. Nobody will mention this.',
      'Goldie has gone swimming. In the ditch. With great dignity.',
      'The fish has left the tank. Not a sentence anyone wants to read.',
      'Goldie forgot you instantly. That is the only good news here.',
      'Rest in puddles, Goldie.',
      'The fish was the only one who never complained. Look where that got him.',
      'Goldie is now a local legend at the roadside pond.',
    ],
    broken: [
      'The tank cracked. Goldie is fine. Goldie is in a saucepan. Goldie is fine.',
      'Goldie arrived in a mug. A chipped one.',
      'The fish tank is now a fish puddle with ambitions.',
      'Goldie survived the crash. Goldie will need therapy. Fish therapy is a bowl.',
      'Water everywhere, and one very calm fish in the sink.',
    ],
  },
  fridge: {
    gone: [
      'We can buy a new fridge. Probably.',
      'The fridge is on the road. The leftovers are on the road. Lunch is on the road.',
      'No fridge. Dinner tonight is room-temperature everything.',
      'A fridge fell off a moving truck. Somewhere, a fox is having the best night of its life.',
      'The milk is going off. Everywhere. All at once.',
      'Good news: the new kitchen has a lot of space. Where the fridge would go.',
      'You lost the fridge. The magnets made it. They are holding up nothing.',
      'Somebody on that road has a free fridge and a very confusing story.',
      'Fridge status: chilling. On the verge. Forever.',
      'The fridge is gone and so is any chance of cold butter this year.',
      'Ice cream for breakfast, lunch and dinner. It is not a treat, it is an emergency.',
    ],
  },
  washer: {
    gone: [
      'No washing machine. The laundromat is now your second home.',
      'The washing machine was last seen spinning down a hill. One last cycle.',
      'Clean clothes are a memory now.',
      'Somewhere out there, a washing machine finished its final spin.',
      'You will wash your socks in the sink like a Victorian orphan.',
      'The washer went off on its own. On the rinse cycle. Into the river.',
      'No washing machine, so everything you own now smells faintly of truck.',
      'Your socks will never be fully clean again. You knew that already.',
      'A washing machine on the road is a hazard. A washing machine in a ditch is a planter.',
      'Hand wash only, from now on. Everything. Including your dignity.',
    ],
  },
  sofa: {
    gone: [
      'No sofa. You will sit on the floor like a philosopher.',
      'The sofa is gone. So are the coins down the back of it. Forty years of coins.',
      'Movie night is cancelled. Movie night is a stool.',
      'The sofa fell off. It always did lean a bit to the left.',
      'Somewhere a field has a sofa in it now. Cows will sit on it. Cows deserve that.',
      'Your guests can stand. Your guests should have brought a chair.',
      'The sofa is out there, and the TV remote is still inside it.',
      'You have a living room. You do not have a sitting room.',
      'Every sofa dreams of being dumped on a verge. This one made it.',
      'No sofa means no naps. No naps means no peace.',
    ],
  },
  armchair: {
    gone: [
      'The armchair was Grandpa\'s. Grandpa will hear about this.',
      'No armchair. Reading is now done standing up, like a train passenger.',
      'The armchair is gone. It took the good cushion with it.',
      'An armchair is now enjoying a view of the valley. It earned it.',
      'Somebody will find that armchair, sit in it, and never get up again.',
      'Your favourite chair has left you for the open road.',
      'The armchair is out there, and so is the dent you spent ten years making in it.',
      'The cat\'s favourite chair is gone. Expect consequences.',
      'You can still sit down at home. Just not comfortably.',
      'Grandpa\'s chair finally went on that road trip he always talked about.',
    ],
  },
  tv: {
    gone: [
      'No TV. You will have to talk to each other.',
      'The TV is gone. You will now find out how the series ends from the internet, in spoilers.',
      'The old TV fell off. It had seen enough.',
      'Somebody on the road just got a free TV. It only shows one channel. It is the weather.',
      'No telly. The evenings are long and full of eye contact.',
      'The TV is in a ditch, still showing a test card to a sheep.',
      'You lost the TV. The remote made it. It controls nothing now. Like you.',
      'The TV took one last look at the road and switched itself off.',
      'Entertainment tonight: watching the kettle boil.',
      'No TV. The wall where it went is very interesting. You will be watching it a lot.',
    ],
    broken: [
      'The TV cracked. Every show is now a mosaic.',
      'The TV still works. It just shows everything slightly sideways.',
      'The screen cracked right down the middle. Every film is now two films.',
      'The TV arrived in two pieces. Double the TV, half the picture.',
      'The TV now only gets the snooker. And the snooker is green static.',
    ],
  },
  bookshelf: {
    gone: [
      'No bookshelf. The books are now a floor.',
      'The bookshelf is gone. You will have to pretend you read on a Kindle.',
      'A bookshelf fell off the truck and landed, perfectly upright, in a lay-by. A library now.',
      'Your books are stacked on the floor. You call it a design choice.',
      'The bookshelf left. The books stayed. They are not happy about it.',
      'No bookshelf, so the books are on the windowsill, judging the view.',
      'The bookshelf is out there, holding up nothing, at peace.',
      'Flat-pack is cheap. Your patience is not. Good luck.',
      'The bookshelf was the only thing in the house that was organised.',
      'Without the bookshelf, the new house has no personality. Just walls.',
    ],
  },
  mattress: {
    gone: [
      'No mattress. Tonight you sleep on the floor, like a cowboy.',
      'The mattress fell off. A very lucky hedgehog has a king-size now.',
      'You lost the mattress. Your back has not forgiven you. Your back never will.',
      'Sleeping on the sofa tonight. If you still have the sofa.',
      'The mattress is out there. So are eleven years of you on it. Grim.',
      'A mattress by the road is a sad sight. A mattress you own by the road is worse.',
      'First night in the new house: on a pile of coats.',
      'The mattress blew off like a magic carpet. It never came down.',
      'No mattress. You will lie awake, which is fine, since you cannot sleep anyway.',
      'You can rent a mattress. You cannot rent a good night\'s sleep.',
    ],
  },
  rug: {
    gone: [
      'The rug really tied the room together. Now the room is just a room.',
      'No rug. The floors are cold and the floors are honest.',
      'The rug unrolled itself onto the motorway. A red carpet for no one.',
      'Somebody\'s car now has a very nice rug underneath it.',
      'The rug is gone. The stain it was hiding came with you.',
      'The rug is out there, being walked on by strangers. As rugs are.',
      'You lost the rug. The floor has never looked so floor-like.',
      'No rug, so the echo in the new house is really something.',
      'The rug flew off like a magic carpet. Then remembered it was not one.',
      'Bare floors. Very modern. Very cold. Very loud.',
    ],
  },
  suitcase: {
    gone: [
      'The suitcase had all your clothes in it. You are wearing your only outfit now. Forever.',
      'The suitcase went on holiday without you.',
      'Your entire wardrobe is now in a hedge. The hedge looks great.',
      'No suitcase. Tomorrow\'s outfit is today\'s outfit.',
      'Somebody has found a suitcase full of your clothes and is wearing them better than you did.',
      'The suitcase burst open on the road. Your socks are scattered across two counties.',
      'Lost luggage, and you did not even fly anywhere.',
      'The suitcase is gone, and so is your one nice shirt.',
      'You will be meeting the new neighbours in yesterday\'s trousers.',
      'The suitcase is travelling now. It always wanted to.',
    ],
  },
  toolbox: {
    gone: [
      'No toolbox. Nothing in the new house will ever be put up.',
      'The toolbox is gone, and with it every screwdriver you could never find anyway.',
      'You now own a flat-pack bookshelf and no Allen key. Good luck.',
      'The shelves will stay on the floor. The pictures will stay in the boxes.',
      'No toolbox. Every fix in the new house will be done with a butter knife.',
      'The toolbox fell off. Ironically, so did the truck\'s back bumper.',
      'You lost the toolbox. The DIY era is over before it began.',
      'A toolbox in the road is a puncture waiting to happen. Sorry, everyone.',
      'The hammer is out there. Everything still looks like a nail.',
      'No tools. You will have to call a man. The man will be expensive.',
    ],
  },
  record: {
    gone: [
      'No record player. The vinyl is now very expensive coasters.',
      'The record player is gone. The house is silent and so are you.',
      'Somebody found a record player on the road and is now insufferable about it.',
      'The record player spun off into the sunset. On repeat.',
      'The records made it. The thing that plays them did not. Very you.',
      'No music tonight. Hum.',
      'The turntable left. The needle dropped. On the motorway.',
      'Your vinyl collection is now art. Wall art. Silent wall art.',
      'The record player is out there, playing to the cows.',
      'You lost the record player. You will be getting into podcasts now.',
    ],
    broken: [
      'The record player works, but everything now sounds like it is underwater.',
      'The needle is bent. Every song now skips at the good bit.',
      'The record player arrived broken. It plays at one speed: wrong.',
      'Everything you play now has a crunch. It is not the vinyl.',
      'The turntable spins backwards now. You may hear messages.',
    ],
  },
  guitar: {
    gone: [
      'The guitar is gone. The neighbours will never know how bad you were.',
      'No guitar. The world is a quieter and kinder place.',
      'Somebody found a guitar on the road and learned Wonderwall. You did this.',
      'The guitar fell off. It had been out of tune for years, it just wanted out.',
      'Your band is over. It was never really together.',
      'The guitar left to pursue a solo career.',
      'No guitar. You will have to find a new personality at parties.',
      'The guitar is in a hedge now, playing the wind. It is better than you were.',
      'You lost the guitar. Your fingertips are free at last.',
      'No guitar. Nobody will ever hear the song you were writing. Thank you.',
    ],
    broken: [
      'The guitar arrived with five strings. It now only plays sad songs.',
      'The guitar neck snapped. It now plays exclusively in heavy metal.',
      'Cracked guitar. It sounds the same as when you played it, honestly.',
      'The guitar is in pieces. Very rock and roll. Very expensive.',
      'The guitar survived, mostly. The high E string did not. Neither did your plans.',
    ],
  },
  clock: {
    gone: [
      'The grandfather clock is gone. Time is meaningless now.',
      'Grandpa\'s clock fell off. It had been running slow for years anyway.',
      'No clock. You will be late for everything, which is your brand.',
      'The grandfather clock is out there, chiming at nobody, on the hour, every hour.',
      'You lost the clock. Time flies. So, apparently, does the clock.',
      'The clock stopped. On the road. Forever. Very poetic.',
      'Grandpa said the clock would outlive you. It did not outlive the truck.',
      'The house is quiet. Too quiet. No ticking. You miss the ticking.',
      'Somebody found a seven-foot clock in a field and is now afraid of it.',
      'The clock is gone. Its time had come.',
    ],
    broken: [
      'The grandfather clock is cracked. It now chimes thirteen. Always.',
      'Grandpa\'s clock arrived in pieces. Grandpa is spinning faster than the hands.',
      'The clock works, but only tells the time in another time zone.',
      'The pendulum snapped. The clock just stares at you now.',
      'The clock face cracked. It is correct twice a day, which is more than before.',
      'Broken clock. Haunted clock, if you listen at night.',
    ],
  },
  lamp: {
    gone: [
      'No lamp. You will be living in the dark. Metaphorically too.',
      'The lamp is gone. The living room is now mood lighting only. The mood is grim.',
      'The floor lamp fell off. It went out on a high.',
      'Somebody on the road has a free lamp. It does not light up their life either.',
      'The lamp left. You will be reading by the glow of the fridge. If you still have a fridge.',
      'No lamp. The big light it is, then. The big light is cruel.',
      'The lamp is out there, standing on a verge, looking quietly elegant.',
      'Lost a lamp. Not a big deal. It was the one lamp that worked.',
      'The new house is very dark. You are going to find out what your face looks like at night.',
      'No lamp. You will be lit by your phone, like a horror film.',
    ],
    broken: [
      'The lamp is bent. It now lights the ceiling and nothing else.',
      'The lampshade got crushed. The lamp looks like it has had a long day too.',
      'The lamp flickers now. Every evening is a thriller.',
      'Broken lamp. The bulb survived, out of sheer stubbornness.',
      'The lamp works, but leans at forty-five degrees, like it is listening in.',
    ],
  },
  plant: {
    gone: [
      'The monstera is gone. It was the only one in the house still growing.',
      'The plant fell off. It is now part of the actual environment. Congratulations.',
      'You lost the plant. It was going to die in your care anyway.',
      'The monstera is out there, finally getting enough sunlight.',
      'No plant. The new house has no oxygen and no vibe.',
      'The plant has gone wild. Literally. It is in a field.',
      'The monstera jumped. You never watered it. Read the room.',
      'One plant lost. One field slightly more interesting.',
      'Your plant is free now. It is already doing better than when you had it.',
      'The plant is gone. Somebody will repot it and it will thrive. Out of spite.',
    ],
    broken: [
      'The pot smashed. The plant is now living in a saucepan, like Goldie.',
      'The monstera snapped in half. Two plants now. Both furious.',
      'The plant survived with one leaf. One very determined leaf.',
      'Soil everywhere. The plant is fine. The truck is a garden now.',
      'The plant arrived broken. It was already dying. You just sped it up.',
    ],
  },
  jam: {
    gone: [
      'The homemade jam is gone. Gran will hear about this. Gran will not recover.',
      'A whole jar of Gran\'s jam is on the road. A wasp is having the best day of its life.',
      'No jam. Toast will never be the same.',
      'Gran made that jam with love and plums. The road is now sticky with both.',
      'The jam fell off. It was the most valuable thing you owned, emotionally.',
      'You lost the jam. Gran is already making more. Gran is very disappointed.',
      'Somebody found a jar of homemade jam on the road and is eating it with a stick.',
      'The jam is gone. Toast is just warm bread now.',
      'The jam jar is out there, sealed, perfect, and nobody\'s.',
      'No jam. Breakfast is cancelled. Also Christmas.',
    ],
    broken: [
      'The jam jar smashed. The truck is sticky. You are sticky. Everything is sticky.',
      'The jam broke. The truck bed now smells like a very sad bakery.',
      'Gran\'s jam is everywhere now. On the boxes. On the cat. In the fridge vents.',
      'The jam is fine. The glass is in it. Eat carefully.',
      'Broken jam jar. Ants will find the new house before your post does.',
    ],
  },
  chair: {
    gone: [
      'One kitchen chair lost. Somebody is eating standing up for the rest of their life.',
      'The kitchen chair fell off. It always did wobble.',
      'Now there are three chairs and four of you. Musical chairs, every dinner.',
      'Somebody on the road has a free chair and nothing to put it under.',
      'The chair is gone. You will eat at the counter like a bistro. A sad bistro.',
      'A kitchen chair is now a roadside bench for tired hedgehogs.',
      'No chair. Dinner party seating is now first come, first served.',
      'The chair left. It was the comfortable one, of course.',
      'You lost a chair. It is the only chair anyone ever sat on.',
      'The kitchen is lovely. Just do not sit down.',
    ],
  },
  box_s: {
    gone: [
      'The small box is gone. Nobody knows what was in it. Nobody will ever know.',
      'You lost the small box. It was the one with all the cables. Every cable. Ever.',
      'The small box fell off. It had the keys to the new house in it. Just kidding. Probably.',
      'The little box is out there, full of things you never unpacked last time either.',
      'Small box, big loss. It had the passports.',
      'The small box was labelled MISC. It is now MISSING.',
      'Somewhere on the road, a box of mystery batteries is having a fine time.',
      'You lost the small box. The kettle was in it. The day is over.',
      'The small box is gone. Your entire sock drawer was in there.',
      'Labelled FRAGILE, KEEP UPRIGHT. Last seen upside down in a ditch.',
    ],
  },
  box_m: {
    gone: [
      'The box of books is gone. You will have to finish the trilogy from memory.',
      'Your books fell off. A fox is now very well read.',
      'Somebody found a box of books on the road and is now insufferable at dinner parties.',
      'The box of books is out there, slightly damp, deeply literary.',
      'No books. You will have to make conversation in the evenings.',
      'You lost the books. You had not read half of them, but still.',
      'The box of books fell off. It was the heaviest thing. It left the biggest dent.',
      'All your cookbooks are gone. Dinner is toast. Without jam, probably.',
      'The book box is in a ditch. The bookmark is still in on page 212.',
      'Your library is now a public library. It is on the side of the road.',
    ],
  },
  box_l: {
    gone: [
      'The big box is gone. It said KITCHEN. It meant everything.',
      'The big box fell off. That was every single plate.',
      'You lost the big box. It had the kettle. Civilisation has collapsed.',
      'The big box is on the road. It is now a very sturdy fort for a child.',
      'Big box gone. Your mugs, your bowls, your one good pan.',
      'The big box said THIS WAY UP. It did not say THIS WAY OFF.',
      'Somebody has found a box of everything you own and will never return it.',
      'The big box went. The tape on it was doing a lot of heavy lifting.',
      'The big box is gone. The little one has the cables. You have nothing to plug in.',
      'You will be eating off the box lid tonight. The box lid is also gone.',
    ],
  },
};

/** Combinations: the first whose keys are all gone or broken is a candidate. */
const COMBOS: { keys: string[]; lines: Lines }[] = [
  {
    keys: ['cat', 'bird'],
    lines: [
      'The cat and the canary are both gone. Nobody is asking the obvious question.',
      'The bird is missing, the cat is missing. The cat looked very full when last seen.',
      'Biscuit and Sunny left together. Only one of them will come back.',
      'Two pets gone. One of them has a feather in his mouth.',
    ],
  },
  {
    keys: ['cat', 'fish'],
    lines: [
      'The cat and the fish are both missing. The cat was licking his lips.',
      'Goldie and Biscuit are gone. It was always going to end this way.',
      'No cat, no fish. The food chain has relocated.',
      'The cat finally got the fish. Then fell off a truck. Balance.',
    ],
  },
  {
    keys: ['cat', 'bird', 'fish'],
    lines: [
      'Every pet is gone. The house is quiet. Too quiet. You are a monster.',
      'You lost the cat, the bird and the fish. The RSPCA would like a word.',
      'No pets made it. You are now officially a person who should get a cactus.',
      'Three pets, zero arrived. They have started a band without you.',
    ],
  },
  {
    keys: ['fridge', 'washer'],
    lines: [
      'No fridge, no washing machine. The kitchen is just a room with a sink now.',
      'You lost both big appliances. The plumber will be thrilled. And confused.',
      'The fridge and the washer went off together. They were always close.',
      'All the white goods are gone. The kitchen is very minimalist. And useless.',
    ],
  },
  {
    keys: ['sofa', 'tv'],
    lines: [
      'No sofa, no TV. You will have to stare at the wall. From the floor.',
      'The sofa and the telly are gone. Evenings are now a meditation retreat.',
      'Netflix and nothing.',
      'Your living room is a living room in name only.',
    ],
  },
  {
    keys: ['sofa', 'armchair'],
    lines: [
      'No sofa, no armchair. Every seat in the house is a box.',
      'All the comfy seats are gone. Sitting down is a privilege now.',
      'Guests will have to sit on the floor, or stay standing, or stay home.',
    ],
  },
  {
    keys: ['mattress', 'sofa'],
    lines: [
      'No mattress, no sofa. Tonight you sleep in the bath.',
      'Nowhere soft to lie down. The new house is all corners.',
      'You lost the bed and the sofa. The rug is your bed now. If you have the rug.',
    ],
  },
  {
    keys: ['guitar', 'record'],
    lines: [
      'No guitar, no record player. The house has gone silent. The neighbours are relieved.',
      'All the music is gone. You will have to whistle. Badly.',
      'The music room is now just a room.',
    ],
  },
  {
    keys: ['bookshelf', 'box_m'],
    lines: [
      'The books and the bookshelf both went. It was a tidy way to lose everything.',
      'No books and nowhere to put them. Perfectly balanced.',
      'You lost the books and the shelf. At least the empty shelf is not mocking you.',
    ],
  },
  {
    keys: ['jam', 'fridge'],
    lines: [
      'No jam, no fridge. Gran\'s last jar and nowhere to keep it. Well, no jar now either.',
      'The jam and the fridge are gone. Breakfast is officially cancelled.',
    ],
  },
  {
    keys: ['lamp', 'tv'],
    lines: [
      'No lamp, no TV. The evenings are long, dark and full of thinking.',
      'Nothing glows in the new house any more. Including you.',
    ],
  },
  {
    keys: ['clock', 'record'],
    lines: [
      'The clock and the record player are gone. Time and music both stopped. Very dramatic.',
    ],
  },
  {
    keys: ['toolbox', 'bookshelf'],
    lines: [
      'You kept the flat-pack and lost the tools. Or the other way round. Either way, no shelf.',
      'No toolbox and no bookshelf. The IKEA dream is dead.',
    ],
  },
  {
    keys: ['suitcase', 'washer'],
    lines: [
      'No clothes and nothing to wash them in. Perfectly matched, in the worst way.',
      'Your clothes are gone, and so is the washing machine. At least there is no laundry.',
    ],
  },
  {
    keys: ['box_s', 'box_m', 'box_l'],
    lines: [
      'You lost every box. You moved the furniture and forgot the life.',
      'All the boxes are gone. The new house has furniture, and absolutely nothing else.',
      'Every box fell off. Somewhere, a road is fully furnished with your stuff.',
    ],
  },
  {
    keys: ['chair', 'sofa', 'armchair'],
    lines: ['Not one thing to sit on. The new house is a standing-only venue.'],
  },
];

/** Nothing lost on the road and nothing broken. */
const PERFECT: Lines = [
  'A perfect move. The neighbours are impressed.',
  'Everything arrived. Nobody has ever done this. Nobody will believe you.',
  'Not a scratch. Not a dent. Not a single missing sock. Are you even human?',
  'Perfect delivery. The removal companies are terrified of you.',
  'Everything made it. Biscuit is almost impressed. Almost.',
  'Flawless. The truck deserves a medal. So do you. Mostly the truck.',
  'Every single thing arrived. Gran has already told the whole village.',
  'A perfect move. You will never be allowed to forget this. Neither will anyone else.',
  'Nothing lost, nothing broken. Frame this score card. Hang it. You have a hammer.',
  'Perfect. Now unpack. That part takes four years.',
];

/** All delivered, but a few things broke on the way. */
const MOSTLY: Lines = [
  'Most of it made it. Good enough!',
  'A few bumps, a few cracks, a lot of character.',
  'Everything is here. Some of it is here in more pieces than before.',
  'You arrived. Your stuff arrived. Not all of it arrived in the same shape.',
  'It is not broken, it is distressed. That is a look now.',
];

/** Nothing at all arrived. */
const EMPTY: Lines = [
  'We are minimalists now.',
  'Everything you own is somewhere else. You are free.',
  'You moved house. Just the house. Nothing in it.',
  'The truck arrived empty. Bold. Very bold.',
  'You now own a house and the clothes you are wearing.',
  'Nothing made it. Marie Kondo is weeping with joy.',
  'An empty house is a blank canvas. A very cold, echoey blank canvas.',
];

/** Lots gone, by stars, when nothing more specific fits. */
const BY_STARS: Lines[] = [
  ['We can buy a new everything. Probably.', 'It went about as well as a move ever goes. Badly.', 'Most of your life is on the side of a road now.', 'You call it a move. The road calls it a donation.'],
  ['We can buy a new fridge. Probably.', 'Some of it made it. Some of it is in a hedge. Life is balance.', 'Not your best move. Not your worst. Your worst is coming.'],
  ['Most of it made it. Good enough!', 'A respectable move, with a few casualties.', 'You lost a few things. You found a new home. Fair trade.'],
  ['A great move. A few things went missing, but who needs things?', 'Nearly perfect. Nearly.'],
];

/** How funny a loss is, roughly how much it hurts: the pets first, then the big things. */
const WEIGHT: Record<string, number> = {
  cat: 100, bird: 90, fish: 88, jam: 80, clock: 75, fridge: 72, mattress: 70, washer: 66, sofa: 64, tv: 62, guitar: 60,
  suitcase: 58, record: 56, armchair: 54, plant: 52, toolbox: 50, bookshelf: 48, lamp: 46, box_l: 44, box_m: 42, rug: 40, chair: 38, box_s: 36,
};

const PETS = new Set(['cat', 'bird', 'fish']);

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** The joke for how this move went. */
export function verdictFor(o: Outcome): string {
  // What went wrong on the road: things that fell off and things that broke. Things never packed only count
  // if they are pets (the truck cannot carry everything, and leaving the toolbox behind is not a story;
  // leaving the cat behind is).
  const gone = new Set([...o.lost, ...o.left.filter((k) => PETS.has(k))]);
  const broken = new Set(o.broken.filter((k) => !gone.has(k)));
  const hurt = new Set([...gone, ...broken]);

  if (o.delivered.length === 0 && o.broken.length === 0) return pick(EMPTY);
  if (hurt.size === 0) return pick(PERFECT);

  // A combination of losses that tells its own story: the biggest one that fits, most of the time.
  const combos = COMBOS.filter((c) => c.keys.every((k) => hurt.has(k))).sort((a, b) => b.keys.length - a.keys.length);
  if (combos.length && Math.random() < 0.6) return pick(combos[0].lines);

  // Otherwise the thing that hurts most (now and then the second most, for variety).
  const ranked = [...hurt].filter((k) => ITEMS[k]).sort((a, b) => (WEIGHT[b] ?? 0) - (WEIGHT[a] ?? 0));
  const key = ranked.length > 1 && Math.random() < 0.25 ? ranked[1] : ranked[0];
  if (key) {
    const it = ITEMS[key];
    if (broken.has(key) && it.broken) return pick(it.broken);
    if (gone.has(key)) return pick(it.gone);
  }
  if (gone.size === 0) return pick(MOSTLY);
  return pick(BY_STARS[Math.max(0, Math.min(3, o.stars))]);
}

/** Every line, for checking lengths and for tests. */
export const ALL_LINES = [
  ...Object.values(ITEMS).flatMap((i) => [...i.gone, ...(i.broken ?? [])]),
  ...COMBOS.flatMap((c) => c.lines),
  ...PERFECT,
  ...MOSTLY,
  ...EMPTY,
  ...BY_STARS.flat(),
];
