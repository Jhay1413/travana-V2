import { motion } from "framer-motion";
import { Link } from "wouter";
import { MapPin, ArrowRight } from "lucide-react";
import { COLORS, fadeUp, stagger, useScrollInView, serifFont, PageWrapper, PageHero } from "./shared";

const destinations = [
  { name: "Santorini", region: "Europe", description: "Iconic whitewashed villages perched on volcanic cliffs above the Aegean Sea.", image: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80" },
  { name: "Amalfi Coast", region: "Europe", description: "Dramatic coastal scenery with pastel villages, lemon groves, and turquoise waters.", image: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80" },
  { name: "Swiss Alps", region: "Europe", description: "Majestic mountain peaks, pristine lakes, and charming alpine villages.", image: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&q=80" },
  { name: "Bali", region: "Asia", description: "Lush rice terraces, ancient temples, and world-class surfing in tropical paradise.", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80" },
  { name: "Tokyo", region: "Asia", description: "A dazzling blend of ultramodern technology, ancient traditions, and Michelin-starred cuisine.", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80" },
  { name: "Maldives", region: "Indian Ocean", description: "Crystal-clear waters, overwater villas, and some of the world's finest coral reefs.", image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&q=80" },
  { name: "Barbados", region: "Caribbean", description: "Golden beaches, rum distilleries, and vibrant culture on this island gem.", image: "https://images.unsplash.com/photo-1548574505-5e239809ee19?w=600&q=80" },
  { name: "St. Lucia", region: "Caribbean", description: "Twin Piton mountains rising from the sea, volcanic beaches, and luxury resorts.", image: "https://images.unsplash.com/photo-1580237072353-767e381b22bb?w=600&q=80" },
  { name: "Marrakech", region: "Africa", description: "Vibrant souks, stunning riads, and the gateway to the Sahara Desert.", image: "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=600&q=80" },
  { name: "Cape Town", region: "Africa", description: "Table Mountain views, world-class vineyards, and breathtaking coastal drives.", image: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600&q=80" },
  { name: "Dubai", region: "Middle East", description: "Futuristic skyline, luxury shopping, and desert adventures in the Arabian Gulf.", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80" },
  { name: "Machu Picchu", region: "Americas", description: "The legendary Incan citadel nestled high in the Andes mountains of Peru.", image: "https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=600&q=80" },
  { name: "Patagonia", region: "Americas", description: "Towering glaciers, windswept plains, and some of Earth's last untouched wilderness.", image: "https://images.unsplash.com/photo-1531794717718-4636b438ea15?w=600&q=80" },
  { name: "Kyoto", region: "Asia", description: "Serene bamboo groves, thousands of temples, and exquisite traditional tea houses.", image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80" },
];

export default function TravanaDestinations() {
  const { ref, isInView } = useScrollInView(0.05);

  return (
    <PageWrapper>
      <PageHero
        title="Explore Our Destinations"
        subtitle="From sun-kissed beaches to snow-capped peaks, discover the world's most extraordinary places."
        imageSrc="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80"
      />

      <section ref={ref} className="py-20 md:py-28 bg-white" data-testid="section-destinations-grid">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <motion.div
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {destinations.map((dest, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="group overflow-hidden bg-white transition-all duration-500"
                style={{ border: `1px solid ${COLORS.creamDark}` }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
                data-testid={`card-destination-${i}`}
              >
                <div className="relative overflow-hidden" style={{ aspectRatio: "16/10" }}>
                  <img
                    src={dest.image}
                    alt={dest.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute top-4 left-4">
                    <span
                      className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white"
                      style={{ backgroundColor: `${COLORS.navy}cc`, backdropFilter: "blur(4px)" }}
                    >
                      {dest.region}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="w-3.5 h-3.5" style={{ color: COLORS.gold }} />
                    <h3 className="text-lg font-semibold" style={{ color: COLORS.navy }}>{dest.name}</h3>
                  </div>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: COLORS.warmGray }}>{dest.description}</p>
                  <Link href="/travana/destinations">
                    <span
                      className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors cursor-pointer"
                      style={{ color: COLORS.gold }}
                      data-testid={`button-explore-${i}`}
                    >
                      Explore
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </PageWrapper>
  );
}
