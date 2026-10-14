/**
 * Sujets de conversation que Prax sait traiter dans Elyndor.
 *
 * Prax ne lit pas le lore : il manipule des faits. Chaque sujet est donc un
 * identifiant (`sait.<pnj>.<sujet>`) avec les mots qui le désignent dans un
 * message du joueur, les personnages qui le connaissent et deux ou trois
 * répliques écrites à partir des fiches du lore d'Elyndor
 * (src/data/elyndorLore.json). Les fiches explicites ou réservées au profil
 * adulte ne sont pas reprises ici.
 */
import type { TypeRole } from '../rolesCanon';

/** Rôle d'un PNJ dans le monde de Prax : un rôle fixé par le lore, ou un rôle générique. */
export type RolePnj = TypeRole | 'marchand' | 'mage' | 'ombre' | 'garde' | 'habitant';

export interface SujetPrax {
  id: string;
  /** Nom affiché dans le récit (« la Guilde des Aventuriers »). */
  nom: string;
  motif: RegExp;
  /** Qui le connaît : tout le monde, ou certains rôles seulement. */
  connuDe: 'tous' | RolePnj[];
  repliques: string[];
}

const TOUS_GUILDE: RolePnj[] = ['maitresse_guilde', 'receptionniste'];

export const SUJETS: SujetPrax[] = [
  {
    id: 'guilde_aventuriers',
    nom: 'la Guilde des Aventuriers',
    motif: /guilde des aventuriers|\bcontrats?\b|\bmissions?\b|\bqu[êe]tes?\b|\bprimes?\b|\brangs?\b|\btableau\b|\btravail\b|\bboulot\b/i,
    connuDe: [...TOUS_GUILDE, 'taverniere'],
    repliques: [
      'Les contrats sont affichés au tableau, classés par rang. Bronze pour les débutants, Fer pour les confirmés… et plus le rang monte, plus on enterre de monde.',
      'Un contrat validé fait monter ton rang. Un contrat abandonné sans raison, et c’est la suspension.',
      'La Guilde reste neutre dans toutes les guerres. Elle paie, elle exige, elle n’oublie rien.',
    ],
  },
  {
    id: 'guilde_marchands',
    nom: 'la Guilde des Marchands',
    motif: /guilde des marchands|\bmarchands?\b|lettres? de cr[ée]dit|\bcaravanes?\b|liste noire|\bcomptoirs?\b/i,
    connuDe: ['marchand', 'taverniere', 'passeuse'],
    repliques: [
      'La Guilde des Marchands tient les bourses de la moitié du monde. Son siège est à Istanbul, et ses listes noires circulent dans les quatorze capitales.',
      'Une dette enregistrée chez les Marchands te suit partout. Partout.',
      'Elle ne prend jamais parti, la Guilde. Elle vend aux deux camps.',
    ],
  },
  {
    id: 'ordre_mages',
    nom: 'l’Ordre des Mages',
    motif: /ordre des mages|\blicences?\b|\barchimages?\b|\bconclave\b|\brenégats?\b|\brenegats?\b|tour de l.ordre/i,
    connuDe: ['mage', 'maitresse_guilde', 'souverain'],
    repliques: [
      'Sans licence de l’Ordre, pratiquer la magie avancée, c’est signer son arrêt. Leurs Traqueurs ramènent les renégats… ou les font disparaître.',
      'L’Ordre a une tour dans chaque capitale. Sauf à Delhi, qui tolère à peine une antenne.',
    ],
  },
  {
    id: 'guilde_ombres',
    nom: 'la Guilde des Ombres',
    motif: /guilde des ombres|\bp[èe]gre\b|march[ée] noir|\bcontrebande\b|\breceleurs?\b|faux papiers/i,
    connuDe: ['ombre', 'taverniere'],
    repliques: [
      'La Guilde des Ombres ? Elle n’existe pas. Enfin, c’est ce qu’on répond quand on tient à sa langue.',
      'Ils tiennent parole aussi rigoureusement qu’un banquier nain. Et ceux qui parlent trop, on ne les revoit pas.',
    ],
  },
  {
    id: 'voiles',
    nom: 'les Voiles',
    motif: /\bvoiles?\b|\bfissures?\b|\bproph[ée]tie\b|r[ée]veil/i,
    connuDe: 'tous',
    repliques: [
      'Les vieilles cicatrices des Voiles se rouvrent, à ce qu’on dit. Les récoltes pourrissent en bordure des zones.',
      'Les contrats en zone corrompue rapportent plus qu’avant. Ils tuent plus, aussi.',
    ],
  },
  {
    id: 'zones_corrompues',
    nom: 'les zones corrompues',
    motif: /zones? corrompues?|\bcorruption\b|terres? mortes?|for[êe]t noire|marais hurlants|steppe morte/i,
    connuDe: [...TOUS_GUILDE, 'taverniere', 'mage'],
    repliques: [
      'En bordure, la végétation est malade et la magie picote. Plus loin, les couleurs sont fausses et le silence n’est pas naturel.',
      'Les expéditions n’en reviennent pas toutes. Celles qui reviennent rapportent des fortunes.',
    ],
  },
  {
    id: 'creatures',
    nom: 'les créatures des Voiles',
    motif: /\bcr[ée]atures?\b|\bmonstres?\b|[ée]corcheurs?|hurleuses?|mortes?-brumes?|\bb[êe]tes?\b/i,
    connuDe: [...TOUS_GUILDE, 'taverniere', 'forgeronne'],
    repliques: [
      'Les écorcheurs chassent en meute, sans un bruit. Seuls, ils sont lâches. À cinq, ils sont mortels.',
      'Les mortes-brumes ne craignent ni lame ni flèche. Seuls le feu et l’aube les dispersent.',
    ],
  },
  {
    id: 'portes_astra',
    nom: 'les Portes Astra',
    motif: /portes? astra|\bportails?\b|t[ée]l[ée]portation|laissez-passer|\bpasseuses?\b/i,
    connuDe: ['passeuse', 'receptionniste', 'marchand', 'taverniere'],
    repliques: [
      'Les Portes Astra relient les quatorze capitales en un battement de cœur. Cinq pièces d’argent le trajet standard, quinze pour passer sans faire la file.',
      'Chaque traversée laisse une trace. Les autorités peuvent la consulter, alors réfléchis avant de fuir par là.',
    ],
  },
  {
    id: 'garde',
    nom: 'la garde',
    motif: /\bgardes?\b|\bpatrouilles?\b|\bguet\b|\bmilices?\b|\barrestation\b|couvre-feu/i,
    connuDe: 'tous',
    repliques: [
      'Dégaine dans les beaux quartiers, et la garde est là en quelques minutes. Dans les bas-fonds, personne ne viendra.',
      'Un crime sans témoin, la garde ne le connaît pas. Il lui faut une plainte, une enquête, ou de la chance.',
    ],
  },
  {
    id: 'voyage',
    nom: 'le voyage',
    motif: /\bvoyages?\b|\broutes?\b|\bauberges?\b|\bchambres?\b|\bdormir\b|\bbandits?\b|\bh[ée]bergement\b/i,
    connuDe: ['taverniere', 'passeuse', 'marchand', 'habitant'],
    repliques: [
      'Un dortoir commun te coûtera trois cuivres, une chambre privée une dizaine. Sur les routes secondaires, méfie-toi des bandits.',
      'Seul sur la route, tu es une proie. Les caravanes acceptent les lames en échange de leur protection.',
    ],
  },
  {
    id: 'monnaie',
    nom: 'l’argent',
    motif: /\bmonnaie\b|\bpi[èe]ces?\b|\bcuivres?\b|\bbourse\b|combien|\bprix\b|\bco[ûu]te\b|\btarifs?\b/i,
    connuDe: 'tous',
    repliques: [
      'Une pièce d’or vaut dix d’argent, une d’argent dix de cuivre. Un cuivre, c’est un pain ou une chope.',
      'Une bonne journée de travail se paie une pièce d’argent. Un mois de vie modeste, une pièce d’or.',
    ],
  },
  {
    id: 'geopolitique',
    nom: 'les tensions entre royaumes',
    motif: /g[ée]opolitique|\bguerres?\b|\balliances?\b|\bfronti[èe]res?\b|\bambassades?\b|\btensions?\b|\bespions?\b/i,
    connuDe: ['souverain', 'passeuse', 'maitresse_guilde', 'marchand'],
    repliques: [
      'Ni guerre ni paix. Paris et Tokyo se disputent les Portes, Tokyo et Delhi se capturent des soldats à la frontière.',
      'Chaque ambassade est un nid d’espions. Les alliances tiennent tant qu’elles rapportent.',
    ],
  },
  {
    id: 'justice',
    nom: 'la justice',
    motif: /\bjustice\b|\bproc[èe]s\b|\btribunal\b|\bjuges?\b|\bverdict\b|\bsentence\b|\bcachot\b/i,
    connuDe: ['garde', 'souverain', 'marchand', 'habitant'],
    repliques: [
      'Quatre justices se partagent la ville : celle du roi, celle des guildes, celle des temples et celle de la rue. La dernière est la plus rapide.',
      'Un procès, ici, c’est surtout une affaire de témoins. Et de qui les paie.',
    ],
  },
  {
    id: 'magie',
    nom: 'la magie',
    motif: /\bmagie\b|\bsorts?\b|\barcanes?\b|\bmages?\b|\bmagique\b|\bsortil[èe]ges?\b/i,
    connuDe: ['mage', 'maitresse_guilde', 'souverain', 'forgeronne'],
    repliques: [
      'La magie est partout, mais pas pour tout le monde. Toute magie avancée a un prix, et ce prix se voit.',
      'Les soins ne ramènent jamais les morts. Et près des zones corrompues, les sorts se retournent contre leurs lanceurs.',
    ],
  },
  {
    id: 'legendes',
    nom: 'les légendes',
    motif: /\bl[ée]gendes?\b|\bmythes?\b|\bcontes?\b|on raconte|\brumeurs?\b|treizi[èe]me royaume|dame des portes/i,
    connuDe: ['taverniere', 'passeuse', 'habitant'],
    repliques: [
      'On raconte qu’une Dame traverse les Portes sans payer, les nuits sans lune. Les Passeuses n’en rient pas.',
      'Il paraît qu’un treizième royaume a été englouti pendant la Guerre des Voiles. Sa Porte existerait encore, fermée de l’intérieur.',
    ],
  },
];

/** Les capitales : un sujet par ville, connu de tous ceux qui y vivent. */
const VILLES: Array<{ ville: string; nom: string; motif: RegExp; replique: string }> = [
  { ville: 'Paris', nom: 'Paris', motif: /\bparis\b|henri valmonde|culte de la lumi[èe]re|\bcath[ée]drale\b/i, replique: 'Paris obéit au roi Henri Valmonde et au Culte de la Lumière. Un Inquisiteur peut interroger n’importe qui, sauf le roi.' },
  { ville: 'Tokyo', nom: 'Tokyo', motif: /\btokyo\b|aelindra|voie des anciens/i, replique: 'À Tokyo, l’impératrice Aelindra règne sur un empire de castes. Sa parole est loi, son silence est terreur.' },
  { ville: 'Delhi', nom: 'Delhi', motif: /\bdelhi\b|olga discordia|lame ancestrale/i, replique: 'À Delhi, l’armée est l’État. Une capitaine respectée passe avant un noble qui n’a jamais combattu.' },
  { ville: 'Oslo', nom: 'Oslo', motif: /\boslo\b|\bthyra\b|valkyries?/i, replique: 'À Oslo, l’honneur au combat est la seule monnaie qui compte. Mourir dans son lit y est la vraie défaite.' },
  { ville: 'Istanbul', nom: 'Istanbul', motif: /\bistanbul\b|\bsultan\w*|\bbazar\b/i, replique: 'À Istanbul, le commerce est la vraie religion, et la parole donnée en affaires vaut serment sacré.' },
  { ville: 'Lagos', nom: 'Lagos', motif: /\blagos\b|\badanna\b|amazones? sombres?/i, replique: 'Lagos porte l’ostracisme du monde depuis la Guerre des Voiles. Elle le porte avec une fierté de fer.' },
  { ville: 'Johannesburg', nom: 'Johannesburg', motif: /johannesburg|\bokoro\b|orques? nobles?/i, replique: 'À Johannesburg, la parole d’un clan engage tout le clan, pour des générations. Mentir sous les pierres levées est le crime suprême.' },
  { ville: 'Mexico', nom: 'Mexico', motif: /\bmexico\b|\btloc\b|\bwarchief\b/i, replique: 'À Mexico, le Warchief règne tant qu’il est le plus fort. N’importe quel chef peut le défier en duel public.' },
  { ville: 'New York', nom: 'New York', motif: /new york|\bkira\b|hommes?-b[êe]tes?/i, replique: 'À New York, les frontières des meutes se sentent plus qu’elles ne se voient. Le nez remplace les cartes.' },
  { ville: 'Bogotá', nom: 'Bogotá', motif: /bogot[áa]|\binti\b|tribus? primales?/i, replique: 'À Bogotá, les esprits conseillent et la Grande Chamane arbitre. Ceux des zones corrompues se taisent depuis peu.' },
  { ville: 'Sydney', nom: 'Sydney', motif: /\bsydney\b|\bcoral\b|sir[èe]nes?/i, replique: 'À Sydney, la cour est à moitié sous l’eau, et le pouvoir se chante autant qu’il se décrète.' },
  { ville: 'Auckland', nom: 'Auckland', motif: /\bauckland\b|ssythar|\bnagas?\b/i, replique: 'Auckland est presque entièrement sous l’eau. La surface n’est qu’une ambassade tolérée par les Naga.' },
  { ville: 'Zurich', nom: 'Zurich', motif: /\bzurich\b|\bdurin\b|\bnains?\b/i, replique: 'À Zurich, la richesse et la parole tenue font le rang. Les registres des nains font foi de tout.' },
  { ville: 'Katmandou', nom: 'Katmandou', motif: /katmandou|\boya\b|g[ée]antes?/i, replique: 'À Katmandou, les Géantes méditent des décennies sur les cimes. Des pèlerins grimpent des semaines pour lire une seule de leurs phrases.' },
];

export function idVille(ville: string): string {
  return `ville_${ville.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
}

for (const v of VILLES) {
  SUJETS.push({ id: idVille(v.ville), nom: v.nom, motif: v.motif, connuDe: 'tous', repliques: [v.replique] });
}

const PAR_ID = new Map(SUJETS.map((s) => [s.id, s]));

export function sujetPrax(id: string): SujetPrax | undefined {
  return PAR_ID.get(id);
}

/** Les sujets connus d'un PNJ : les sujets communs, ceux de son rôle et sa ville. */
export function sujetsConnus(role: RolePnj, ville: string): string[] {
  const villeId = idVille(ville);
  return SUJETS.filter((s) => {
    if (s.id.startsWith('ville_')) return s.id === villeId || role === 'souverain' || role === 'passeuse';
    return s.connuDe === 'tous' || s.connuDe.includes(role);
  }).map((s) => s.id);
}

/** Les sujets cités dans un texte, dans l'ordre du catalogue. */
export function sujetsCites(texte: string): string[] {
  return SUJETS.filter((s) => s.motif.test(texte)).map((s) => s.id);
}
