/**
 * Curated list of Indian cities used as the suggestion source for the
 * registration form's City field. Covers the cities that account for the vast
 * majority of registrations on AnalytixLabs landing pages (Tier-1 + Tier-2 +
 * major Tier-3). Not exhaustive — users can still type a city not in this
 * list, the validation only enforces format (letters/spaces/hyphens).
 *
 * Sorted by approximate population / typical lead volume.
 */
// Raw list — may contain duplicates if edited by hand. We de-dupe below.
const _RAW_CITIES: readonly string[] = [
  // Metros
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
  // NCR + major Tier-1
  'Gurugram', 'Noida', 'Ghaziabad', 'Faridabad', 'Pune', 'Ahmedabad',
  'Surat', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane',
  'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ludhiana', 'Agra',
  'Nashik', 'Rajkot', 'Meerut', 'Kalyan-Dombivli', 'Vasai-Virar',
  'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Allahabad',
  'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada',
  'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh',
  'Solapur', 'Hubli-Dharwad', 'Bareilly', 'Moradabad', 'Mysore', 'Tiruchirappalli',
  'Aligarh', 'Bhubaneswar', 'Salem', 'Mira-Bhayandar', 'Warangal', 'Thiruvananthapuram',
  'Guntur', 'Bhiwandi', 'Saharanpur', 'Gorakhpur', 'Bikaner', 'Amravati',
  'Jamshedpur', 'Cuttack', 'Bhavnagar', 'Dehradun', 'Durgapur', 'Asansol',
  'Nanded', 'Kolhapur', 'Ajmer', 'Ulhasnagar', 'Akola', 'Jamnagar',
  'Loni', 'Siliguri', 'Jhansi', 'Nellore', 'Sangli',
  'Belgaum', 'Mangalore', 'Tirunelveli', 'Malegaon', 'Gaya', 'Tiruppur',
  'Davanagere', 'Kozhikode', 'Akbarpur', 'Kurnool', 'Bokaro Steel City', 'Rajahmundry',
  'Ballari', 'Agartala', 'Bhagalpur', 'Latur', 'Dhule', 'Korba',
  'Bhilwara', 'Brahmapur', 'Mysuru', 'Muzaffarpur', 'Ahmednagar', 'Kollam',
  'Raghunathganj', 'Bilaspur', 'Shahjahanpur', 'Thrissur', 'Alwar', 'Kakinada',
  'Nizamabad', 'Sagar', 'Tumkur', 'Hisar', 'Rohtak', 'Panipat',
  'Karnal', 'Bathinda', 'Jalandhar', 'Patiala', 'Shimla', 'Manali',
  'Jammu', 'Pondicherry', 'Goa', 'Panaji', 'Madgaon', 'Vasco da Gama',
  // Less common but frequently submitted
  'Anand', 'Bhilai', 'Ujjain', 'Erode', 'Rourkela', 'Junagadh',
  'Gulbarga', 'Mathura', 'Firozabad', 'Bhatpara', 'Bardhaman',
];

// De-duped at module load time, preserving the original order. Guarantees
// uniqueness for React's `key` prop even if a future edit reintroduces a dupe.
export const INDIAN_CITIES: readonly string[] = Array.from(new Set(_RAW_CITIES));

/**
 * Validates that the typed city looks like a real city name.
 * Rules:
 *   • Trimmed length ≥ 3
 *   • Contains at least one letter
 *   • Allowed chars: letters (any unicode), spaces, hyphens, apostrophes, dots
 *   • No leading/trailing spaces (we trim first)
 *   • No three identical characters in a row ("aaa", "xxx") — catches "asdasd" / "qwerty" style garbage
 */
const CITY_BLOCKLIST = new Set([
  'test', 'demo', 'fake', 'dummy', 'asdf', 'asdasd', 'qwerty', 'abc', 'xyz',
  'city', 'town', 'na', 'n/a', 'none', 'unknown', 'india',
]);

export function isValidCity(input: string): boolean {
  const v = (input ?? '').trim();
  if (v.length < 3) return false;
  if (!/[\p{L}]/u.test(v)) return false;                  // must contain at least one Unicode letter
  if (!/^[\p{L}\p{M} '\-.]+$/u.test(v)) return false;     // letters + combining marks + spaces + hyphens + apostrophes + dots
  if (/(.)\1{2,}/.test(v)) return false;                  // reject "aaa", "qqq", etc.
  if (/\d/.test(v)) return false;                         // no digits
  if (CITY_BLOCKLIST.has(v.toLowerCase())) return false;  // reject obvious placeholder text
  return true;
}
