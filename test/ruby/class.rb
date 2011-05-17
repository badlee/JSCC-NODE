class Majordome
  def initialize(nom)
    @nom = nom.capitalize
  end
 
  def saluer
    puts "Bonjour #{@nom} !"
  end
end
 
m = Majordome.new("patron")

m.saluer
