import streamlit as st
import google.generativeai as genai
from PIL import Image

# Configuración de seguridad
genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
model = genai.GenerativeModel('gemini-1.5-flash')

st.title("🎨 AdFlex - Intelligent Resizer")
st.subheader("Herramienta exclusiva para el equipo de Arte")

uploaded_file = st.file_uploader("Sube el diseño original", type=["png", "jpg", "jpeg"])

if uploaded_file:
    img = Image.open(uploaded_file)
    st.image(img, caption="Diseño cargado", use_container_width=True)
    
    opcion = st.selectbox("¿A qué formato quieres adaptar?", 
                          ["Instagram Post (1080x1080)", "Stories (1080x1920)", "Banner Web"])

    if st.button("Generar Adaptación"):
        with st.spinner('Analizando y adaptando...'):
            # Aquí la IA procesa la imagen
            response = model.generate_content(["Actúa como un Director de Arte. Describe cómo adaptarías esta imagen al formato " + opcion + " manteniendo la coherencia visual.", img])
            st.markdown("### Recomendación de Adaptación:")
            st.write(response.text)
