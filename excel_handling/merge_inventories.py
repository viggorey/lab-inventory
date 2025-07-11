import pandas as pd

# --- CONFIG ---
# Set your file paths here
file1 = '/Users/viggorey/Desktop/lab_inventoryNEW.xlsx'  # Newest inventory
file2 = '/Users/viggorey/Desktop/lab_inventory copy.xlsx'  # Older inventory

# Output files
output_merged = '/Users/viggorey/Desktop/Merged_inventories/merged_no_duplicates.xlsx'

# --- LOAD DATA ---
df1 = pd.read_excel(file1)
df2 = pd.read_excel(file2)

# Standardize column order and names
columns = ['name', 'quantity', 'unit', 'category', 'location', 'source', 'comment']
df1 = df1[columns]
df2 = df2[columns]

# --- CONCATENATE BOTH FILES ---
merged = pd.concat([df1, df2], ignore_index=True)

# --- REMOVE DUPLICATES BASED ON NAME, SOURCE, COMMENT ---
deduped = merged.drop_duplicates(subset=['name', 'source', 'comment'], keep='first')

# --- OUTPUT ---
deduped.to_excel(output_merged, index=False)

print(f"Merged file written to: {output_merged}") 