"""H3 hex grid generation for city coverage with neighborhood geocoding."""

import h3
import math
import logging
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

NYC_NEIGHBORHOODS = [
    ("Lower East Side", 40.7150, -73.9843),
    ("East Village", 40.7264, -73.9818),
    ("SoHo", 40.7233, -74.0030),
    ("Greenwich Village", 40.7336, -74.0027),
    ("West Village", 40.7358, -74.0076),
    ("Chelsea", 40.7465, -74.0014),
    ("Tribeca", 40.7163, -74.0086),
    ("Financial District", 40.7075, -74.0090),
    ("Chinatown", 40.7158, -73.9970),
    ("Williamsburg North", 40.7178, -73.9576),
    ("Williamsburg South", 40.7081, -73.9571),
    ("Greenpoint", 40.7305, -73.9515),
    ("Bushwick", 40.7032, -73.9214),
    ("DUMBO", 40.7033, -73.9890),
    ("Brooklyn Heights", 40.6960, -73.9933),
    ("Cobble Hill", 40.6876, -73.9967),
    ("Boerum Hill", 40.6865, -73.9860),
    ("Park Slope", 40.6711, -73.9776),
    ("Fort Greene", 40.6920, -73.9742),
    ("Clinton Hill", 40.6892, -73.9654),
    ("Bedford-Stuyvesant", 40.6872, -73.9418),
    ("Crown Heights", 40.6694, -73.9422),
    ("Midtown South", 40.7484, -73.9857),
    ("Hell's Kitchen", 40.7638, -73.9918),
    ("Midtown East", 40.7549, -73.9742),
    ("Gramercy Park", 40.7368, -73.9845),
    ("Flatiron District", 40.7411, -73.9897),
    ("Upper East Side South", 40.7686, -73.9598),
    ("Upper West Side South", 40.7788, -73.9818),
    ("Long Island City", 40.7447, -73.9485),
    ("Astoria", 40.7644, -73.9235),
    ("Sunnyside", 40.7433, -73.9196),
    ("Downtown Brooklyn", 40.6934, -73.9857),
    ("Prospect Heights", 40.6774, -73.9678),
    ("Red Hook", 40.6763, -74.0097),
]

BENGALURU_NEIGHBORHOODS = [
    ("Indiranagar", 12.9784, 77.6408),
    ("Koramangala", 12.9352, 77.6245),
    ("HSR Layout", 12.9121, 77.6446),
    ("Church Street", 12.9756, 77.6066),
    ("Lavelle Road", 12.9698, 77.5990),
    ("MG Road", 12.9738, 77.6119),
    ("Jayanagar", 12.9308, 77.5838),
    ("JP Nagar", 12.9063, 77.5857),
    ("Bellandur", 12.9304, 77.6784),
    ("Ulsoor", 12.9817, 77.6200),
    ("Richmond Town", 12.9634, 77.6022),
    ("Malleshwaram", 13.0031, 77.5643),
    ("Sadashivanagar", 13.0068, 77.5813),
    ("BTM Layout", 12.9166, 77.6101),
    ("Domlur", 12.9609, 77.6387),
    ("Whitefield", 12.9698, 77.7499),
]

MUMBAI_NEIGHBORHOODS = [
    ("Bandra West", 19.0596, 72.8295),
    ("Khar West", 19.0700, 72.8338),
    ("Lower Parel", 18.9953, 72.8296),
    ("BKC", 19.0657, 72.8687),
    ("Colaba", 18.9067, 72.8147),
    ("Fort", 18.9322, 72.8335),
    ("Juhu", 19.1075, 72.8263),
    ("Andheri West", 19.1363, 72.8277),
    ("Versova", 19.1351, 72.8146),
    ("Worli", 19.0178, 72.8178),
    ("Powai", 19.1176, 72.9060),
    ("Dadar", 19.0178, 72.8478),
]

DELHI_NEIGHBORHOODS = [
    ("Connaught Place", 28.6304, 77.2177),
    ("Hauz Khas", 28.5494, 77.2001),
    ("Greater Kailash", 28.5401, 77.2403),
    ("Cyber City Gurgaon", 28.4950, 77.0895),
    ("Khan Market", 28.5999, 77.2269),
    ("Vasant Vihar", 28.5606, 77.1610),
    ("Saket", 28.5244, 77.2167),
    ("Defense Colony", 28.5744, 77.2319),
]


def label_for_coordinates(lat: float, lon: float, city: str = "New York City") -> str:
    """Find the nearest neighborhood label for a given coordinate."""
    city_lower = city.lower()
    targets = NYC_NEIGHBORHOODS
    threshold = 0.001

    if "bengaluru" in city_lower or "bangalore" in city_lower:
        targets = BENGALURU_NEIGHBORHOODS
        threshold = 0.0015
    elif "mumbai" in city_lower or "bombay" in city_lower:
        targets = MUMBAI_NEIGHBORHOODS
        threshold = 0.0015
    elif "delhi" in city_lower or "gurgaon" in city_lower or "noida" in city_lower:
        targets = DELHI_NEIGHBORHOODS
        threshold = 0.002

    best_name = None
    min_dist = float("inf")
    for name, n_lat, n_lon in targets:
        d = (lat - n_lat) ** 2 + (lon - n_lon) ** 2
        if d < min_dist:
            min_dist = d
            best_name = name

    if best_name and min_dist < threshold:
        return best_name

    return f"Area ({lat:.3f}, {lon:.3f})"


def get_hexagon_polygon(lat: float, lon: float, radius_km: float, h3_index: str | None = None) -> list[list[float]]:
    """
    Return GeoJSON Polygon coordinates [[lon, lat], ...] for a cell.
    """
    if h3_index:
        try:
            boundary = h3.cell_to_boundary(h3_index)
            coords = [[round(p[1], 6), round(p[0], 6)] for p in boundary]
            if coords:
                coords.append(coords[0])  # Close ring
                return coords
        except Exception:
            pass

    vertices = []
    for i in range(6):
        angle = math.radians(60 * i - 30)
        dx = radius_km * math.cos(angle)
        dy = radius_km * math.sin(angle)
        v_lat = lat + (dy / 111.32)
        v_lon = lon + (dx / (111.32 * math.cos(math.radians(lat))))
        vertices.append([round(v_lon, 6), round(v_lat, 6)])
    vertices.append(vertices[0])
    return vertices


def generate_hex_grid(
    center_lat: float,
    center_lon: float,
    radius_km: float,
    resolution: int | None = None,
    city_name: str = "New York City",
) -> list[dict]:
    """
    Generate H3 hex cells covering a circular area around a center point.
    """
    if resolution is None:
        resolution = settings.H3_RESOLUTION

    edge_length_km = h3.average_hexagon_edge_length(resolution, unit="km")
    center_h3 = h3.latlng_to_cell(center_lat, center_lon, resolution)
    k = max(1, int(radius_km / (edge_length_km * 1.5)))

    cells = h3.grid_disk(center_h3, k)

    results = []
    used_labels: dict[str, int] = {}

    for cell_index in cells:
        cell_lat, cell_lon = h3.cell_to_latlng(cell_index)
        cell_radius_km = edge_length_km * 0.866

        raw_label = label_for_coordinates(cell_lat, cell_lon, city_name)
        if raw_label in used_labels:
            used_labels[raw_label] += 1
            label = f"{raw_label} #{used_labels[raw_label]}"
        else:
            used_labels[raw_label] = 1
            label = raw_label

        polygon = get_hexagon_polygon(cell_lat, cell_lon, cell_radius_km, cell_index)

        results.append(
            {
                "h3_index": cell_index,
                "lat": round(cell_lat, 6),
                "lon": round(cell_lon, 6),
                "radius_km": round(cell_radius_km, 3),
                "polygon": polygon,
                "label": label,
            }
        )

    logger.info(
        "Generated %d H3 cells at resolution %d for %s (%.4f, %.4f) r=%.1fkm",
        len(results),
        resolution,
        city_name,
        center_lat,
        center_lon,
        radius_km,
    )

    return results
