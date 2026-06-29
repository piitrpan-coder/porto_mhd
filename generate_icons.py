import os
from PIL import Image, ImageDraw

def create_app_icon(size):
    # Create image with alpha channel
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # Scale factor for coordinates
    scale = size / 512.0
    
    # Draw dark slate blue circular background with a golden border
    margin = 16 * scale
    bg_box = [margin, margin, size - margin, size - margin]
    
    # Outer dark blue base
    draw.ellipse(bg_box, fill=(15, 23, 42, 255))  # slate-900: #0f172a
    
    # Golden border ring
    border_width = int(12 * scale)
    draw.ellipse(bg_box, outline=(255, 204, 0, 255), width=border_width)  # gold: #FFCC00
    
    # Scale helper
    def s(val):
        return val * scale
        
    # Windshield/Cab body: rounded gold shape
    cab_box = [s(156), s(160), s(356), s(380)]
    try:
        draw.rounded_rectangle(cab_box, radius=s(24), fill=(255, 204, 0, 255))
    except AttributeError:
        draw.rectangle(cab_box, fill=(255, 204, 0, 255))
    
    # Windshield: dark blue screen inside the cab
    windshield_box = [s(176), s(180), s(336), s(270)]
    try:
        draw.rounded_rectangle(windshield_box, radius=s(10), fill=(15, 23, 42, 255))
    except AttributeError:
        draw.rectangle(windshield_box, fill=(15, 23, 42, 255))
    
    # Metro line indicator on windshield (a tiny green light)
    draw.ellipse([s(246), s(190), s(266), s(200)], fill=(34, 197, 94, 255))  # green-500
    
    # Headlights: two golden/yellow circles
    draw.ellipse([s(186), s(320), s(216), s(350)], fill=(255, 255, 255, 255))
    draw.ellipse([s(296), s(320), s(326), s(350)], fill=(255, 255, 255, 255))
    
    # Stylized grill / bumper: simple slate rectangle
    bumper_box = [s(226), s(330), s(286), s(340)]
    try:
        draw.rounded_rectangle(bumper_box, radius=s(4), fill=(100, 116, 139, 255))
    except AttributeError:
        draw.rectangle(bumper_box, fill=(100, 116, 139, 255))
    
    # Tracks / ground lines under the train
    draw.line([s(100), s(410), s(412), s(410)], fill=(255, 204, 0, 255), width=int(8*scale))
    draw.line([s(140), s(435), s(372), s(435)], fill=(255, 204, 0, 180), width=int(6*scale))
    
    return image

if __name__ == "__main__":
    os.makedirs("/home/petr/Dokumenty/Developer/Porto_MHD", exist_ok=True)
    
    # Generate 192x192
    img_192 = create_app_icon(192)
    img_192.save("/home/petr/Dokumenty/Developer/Porto_MHD/icon-192.png", "PNG")
    print("Generated icon-192.png successfully.")
    
    # Generate 512x512
    img_512 = create_app_icon(512)
    img_512.save("/home/petr/Dokumenty/Developer/Porto_MHD/icon-512.png", "PNG")
    print("Generated icon-512.png successfully.")
