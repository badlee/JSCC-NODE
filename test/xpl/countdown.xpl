//A rocketry launch countdown ;)
say '--- The final countdown progam ---\n';

say 'Enter your starting number :';
read count;



say 'Starting sequence...\n';
while count >= 0 do
{
	write count;say '\n';
	//Ignition at 3 loops before lift-off...
	if count == 3 say 'Ignition...\n';
	else if count == 0 say '...and lift-off!\n';
	count = count - 1;
}
say 'end';
