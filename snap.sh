# Remove o arquivo de snapshot antigo se existir
rm -f projeto_snapshot.txt

# Cria o cabeçalho do arquivo
echo "=== SNAPSHOT DO PROJETO FLUXOGUARD ===" > projeto_snapshot.txt
echo "Data: $(date)" >> projeto_snapshot.txt
echo "--------------------------------------" >> projeto_snapshot.txt

# Lista a estrutura de pastas
echo "ESTRUTURA DE PASTAS:" >> projeto_snapshot.txt
find . -maxdepth 2 -not -path '*/.*' >> projeto_snapshot.txt
echo "--------------------------------------" >> projeto_snapshot.txt

# Captura os arquivos importantes do Backend e Frontend
# Nota: Ignoramos .env reais por segurança, capturamos apenas .env.example
find backend frontend -maxdepth 2 -type f \( -name "*.py" -o -name "*.jsx" -o -name "*.js" -o -name "*.json" -o -name "*.yaml" -o -name "*.example" -o -name "*.html" \) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/__pycache__/*" | while read -r file; do
    echo "FILE: $file" >> projeto_snapshot.txt
    echo "CONTENT:" >> projeto_snapshot.txt
    cat "$file" >> projeto_snapshot.txt
    echo -e "\n--- END OF FILE ---\n" >> projeto_snapshot.txt
done

echo "Snapshot gerado com sucesso em: projeto_snapshot.txt"

