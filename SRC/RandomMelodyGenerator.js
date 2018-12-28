/*
Code to create a random melody out of currently selected notes based on settings 
and the random seed

Copyright [2018] [Joseph Cresswell]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

By Joseph Cresswell
*/

//Defining variables to be used throughout the program
ActNotes= [];
SkewNotes = [];
SkewNotesL=[];
var NewActNotes=0;
var currentnotes= 0;
var NeedsTimingInfo =true; 
var isplaying = false;
var newNote=1;
var Divisions=2 ;
var StandardNotes = [1/64,1/32,1/16,1/8,1/4,1/2,1]; //Possible Standard notes 
var DottedNotes = [3/32,3/16,3/8,3/4];   //Possible Dotted Notes
var TripletNotes = [1/12,1/9,1/6,1/3];  //Possible Triplet Notes
var NotesSize=[1/2,1,2];    
var randomNums=[];
var SignatureDen=4;//Time Signature Denominator
var newMinMax=1;
var markerPos=0 ;
var markerFlag=0;
function ProcessMIDI()          //Process MIDI function called one per process block
{
    var info = GetTimingInfo();                 //Get project timing info
    if(SignatureDen!=info.meterDenominator||newMinMax==1) //If time signature has changed or min max values have changed
    {
        var AdjNotes = [] ; //Reset the note arrays 
        var AdjDots = [];
        var AdjTrip= [];
        newMinMax=0;
        SignatureDen=info.meterDenominator;     //Get the new time signature denominator
        var maxLength =parseFloat(GetParameter("Max Note Length"));     //Set new max note length
        var minLength =parseFloat(GetParameter("Min Note Length"));     //Set new min note length
        //If the max note length is bigger than or equal to the minimum
        if(maxLength>=minLength){
            AdjNotes=StandardNotes.slice(minLength,maxLength+1);    //Setting intial array as standard notes array within the set range
            
            //If the dotted notes option is selected include dotted notes in possible note lengths array
            if(GetParameter("Dotted Notes"))
            {
                var AdjDots= DottedNotes.slice(0);  //Add dotted notes to a notes array
                for(i=0;i<AdjDots.length;i++)               //Iterate through dotted notes to find those in range and remove those that aren't
                {
                    if(AdjDots[i]<AdjNotes[0])
                    {
                        AdjDots.shift();
                        i=i-1;
                    }
                    if(AdjDots[i]>AdjNotes[AdjNotes.length-1])
                    {
                        AdjDots.pop();
                        i=i-1;
                    }

                }
            }       
            
            //If the triplet notes option is selected include triplets in the possible note lengths array   
            if(GetParameter("Triplets"))
            {
                var AdjTrip= TripletNotes.slice(0);     //Add triplets to a notes array
                for(i=0;i<AdjTrip.length;i++)                   //Iterate through triplets to find those in range and remove those that aren't
                {
                    if(AdjTrip[i]<AdjNotes[0])
                    {
                        AdjTrip.shift();
                        i=i-1;
                    }
                    if(AdjTrip[i]>AdjNotes[AdjNotes.length-1])
                    {
                        AdjTrip.pop();
                        i=i-1;
                    }

                }
            }   
            
            AdjNotes = AdjNotes.concat(AdjDots, AdjTrip);   //Add triplets and dotted notes to possible notes array
            AdjNotes= constArray(AdjNotes,SignatureDen);        //Adjust note lengths so they work for chosen time signature
            AdjNotes.sort(sortByAscending);                             //Sort array in acsending note lengths
            NotesSize=AdjNotes.slice(0);                                    //Copy array to working note size array
        }
        else
        {
            NotesSize=[1];                                                              //If min size bigger than max size only use 1 beat as note size
        }
    }
    var numSkew=0;
    randomNums= [GetParameter("Rand1"),GetParameter("Rand2"),GetParameter("Rand3")];        //Getting the random seed and putting it into an array
 
    if(isplaying && !info.playing)          //Turning off notes if not playing
    {
        for (i=0; i<ActNotes.length;i++){       //Iterating through all active notes and sending a turn off signal  
            (new NoteOff(ActNotes[i])).send;    
        }
    }
    if(markerPos!=info.blockStartBeat&&isplaying&&!info.cycling)    //If not cycling and marker has shifted from its expected next position, reset the activated notes as to avoid bug of notes playing when not meant to be activated
    {
        for (i=0; i<ActNotes.length;i++){   //Turn off all active notes
            (new NoteOff(ActNotes[i])).send; 
        }
        markerFlag=1;       //Set the marker moved flag
        if(NewActNotes!=info.blockStartBeat||NewActNotes==0)        //If there hasn't been newly activated notes
        {
            ActNotes=[];            //Reset activated notes array
            NewActNotes=0;  //Set activated notes variable to 0
        }
        else{NewActNotes=0;} //Otherwise set activated notes variable to 0 (to indicates no new notes activated)
    }
    markerPos=info.blockEndBeat;    //Set marker position as the end of buffer (aka start of next buffer)
    
    //If previously wasn't playing and is playing now or marker flag has been activated
    if((isplaying == false && info.playing ==true)||markerFlag==1)
    {
        newNote=info.blockStartBeat;        //Set new next beat 
        markerFlag=0;                                   //Reset marker flag
    }
    isplaying = info.playing;                   //Set is playing if currently playing
    
    if(ActNotes.length != 0)        //If there are notes active then calculate what to play next
    {
         if(info.playing)               //If it is playing
         {
                  // calculate beat to schedule
            var lookAheadEnd = info.blockEndBeat;   //Check end of buffer
            var nextBeat = Math.ceil(info.blockStartBeat * Divisions) / Divisions;  //Calculate next beat
               
            // when cycling, find the beats that wrap around the last buffer
            if (info.cycling && lookAheadEnd >= info.rightCycleBeat) {                  //If cycling activated and end beat is bigger than the end cycling beat
                    var cycleBeats = info.rightCycleBeat - info.leftCycleBeat;      //Calculating how many beats in the cycle
                    var cycleEnd = lookAheadEnd - cycleBeats;                                       
            }
            
            // loop through the beats that fall within this buffer
            while ((nextBeat >= info.blockStartBeat && nextBeat < lookAheadEnd)
                   // including beats that wrap around the cycle point
                   || (info.cycling && nextBeat < cycleEnd)) {
                // adjust for cycle
                if (info.cycling && nextBeat >= info.rightCycleBeat)    //if cycling and next beat past cycle threshold
                {
                    nextBeat -= cycleBeats;         //Setting next beat while cycling
                    newNote = nextBeat;                     //Set new note as next beat
                    }
                    if(newNote<nextBeat)    
                    {
                        newNote=nextBeat;
                    }
                if(newNote==nextBeat)                   //If it is time for a new note to be generated
                {
                    if(GetParameter("Include Rests"))       //If rests to be included set rest parameter as 1
                    {
                        var rests =1
                    }
                    else
                    {
                        var rests =0;
                    }
                    
                    //Calculating new array to include skew of note pitches
                    var skew=GetParameter("Note Pitch Skew");       //Get note pitch skew parameter
                    SkewNotes=[];
                    var Alength = ActNotes.length;                          //Get amount of notes
                    SkewNotes=skewCalc(Alength,skew).slice(0);      //Calculate the new adjusted skew array
                    if(rests)                                                                   //If including rests
                    {
                        SkewNotes[SkewNotes.length]=Alength;            //Include rests in the notes in the array
                    }
                    SkewNotesL=[];
                    var skewL=GetParameter("Note Length Skew"); //Get note length skew parameter
                    var ALlength = NotesSize.length;                        //Get amount of possible note sizes
                    SkewLNotes=skewCalc(ALlength,skewL).slice(0);   //Calculated the new adjusted skew array for note lengths
                        
                    // calculate step
                var step = Math.floor(nextBeat *Divisions - Divisions);
                    var NoteIndex =randomNote(SkewNotes.length,nextBeat,0);     //Get the random note to use
                    var chosenNote = SkewNotes[NoteIndex];                                      //Get chosen note
                    var NoteLengthIndex=SkewLNotes[randomNote(SkewLNotes.length,nextBeat*randomNums[2])];   //Get chosen note length
                    var NoteLength = NotesSize[NoteLengthIndex];                            //Get note length
                    var RemoveSlide=0;
                    if(GetParameter("Remove Synth Slide")==1)                               //Set remove slide which reduces note length by tiny amount
                    {
                        RemoveSlide=0.01;
                    }
                 // send events
                 if(rests==0 || chosenNote != ActNotes.length)                  //If note not a rests or rests not activated 
                 {
                    var noteOn = new NoteOn(ActNotes[chosenNote]);              //Create note on event for chosen note
                    var noteOff = new NoteOff(noteOn);                                  //Create note off event for chosen note
                     noteOn.sendAtBeat(nextBeat);                                               //Sent note on event next beat
                        if((nextBeat+NoteLength)>=info.rightCycleBeat)              //If past end of cycle region
                        {
                            noteOff.sendAtBeat(info.rightCycleBeat-RemoveSlide);    //Send note end as end of cyle region
                        }
                        else
                        {
                            noteOff.sendAtBeat(nextBeat + NoteLength-RemoveSlide); //Send note end as end of note length from current point
                        }
                    }
                    newNote = nextBeat + NoteLength;        //Set when a new note is required
   
                    if(GetParameter("Output Notes To Terminal"))        //If required to output notes to the terminal
                    {
                        if(chosenNote != ActNotes.length)                       //If note not a rest
                        {
                            Trace("Note Pitch: "+MIDI.noteName(ActNotes[chosenNote].pitch)+"  Note Length: "+NoteLength/SignatureDen);  //Output note information
                        }
                        else        
                        {
                            Trace("Note Pitch: Rest"+"  Note Length: "+(NoteLength/SignatureDen));  //If note is a rest output note information
                        }
                    }
                }
                // advance to next beat
                nextBeat += 0.001;  //Update next beat
                nextBeat = Math.ceil(nextBeat *Divisions) / Divisions;  //Update next beat for divisions
            }
            
            
                 }

    
    }

}

function HandleMIDI(event)          //Called each time a midi event is recieved
{
    var info = GetTimingInfo();     //Getting the timing info

    if(event instanceof NoteOn)     //If a note on signal recived
    {
        NewActNotes=info.blockStartBeat;        //Set variable that new note on
        ActNotes.push(event);               //Push new note to active notes array
    }
    else if(event instanceof NoteOff)           //If note off signal received
    {
        for(var i in ActNotes)                          //Iterate through all active notes
        {
            if(event.pitch==ActNotes[i].pitch)      //If note off same as a note that is on remove it from the active notes array
            {
                ActNotes.splice(i,1);
            }
        }
    }  
    else {event.send();}            //If other kind of event do nothing to event (let it pass through)
    
    ActNotes.sort(sortByPitchAscending);    //Sort active notes array by acsending notes

}

function sortByPitchAscending(a,b) {        //Function to sort array of notes by acsending pitch
  return a.pitch-b.pitch;
}

function sortByAscending(a,b) {                 //Function to sort array in a acsending number
  return a-b;
}

function randomNote(NumNotes,Currstep)      //Generate a random note by sampling from a fourier series approximation of a triangular wave with decreasing frequency
{
    var x = Currstep;
    var functs = (Math.sin(x*x*randomNums[0]*randomNums[1]/randomNums[2]) - (1/9) * Math.sin(3*x*x*randomNums[0]*randomNums[1]/randomNums[2]) + (1/25) * Math.sin(5*x*x*randomNums[0]*randomNums[1]/randomNums[2]) - (1/49) * Math.sin(7*x*x*randomNums[0]*randomNums[1]/randomNums[2]))/(1+1/9+1/25+1/49);
    return Math.floor(((functs+1)/2)*NumNotes); 
}

function skewCalc(Alength,skew)             //Calculate the skew array
{
    var noteSkew=[];
                    if(skew>0)  //Making it more likely for lower notes to be played
                    {
                            for (i=0; i<Alength;i++){       //Iterating through all notes
                                                numSkew=Math.floor(1.15+skew*(1+Math.cos((i-Alength)*Math.PI*(1/Alength))));
                                                for(j=0; j<numSkew; j++)    //Adding number of notes of that type specified by cosine
                                                {
                                                    noteSkew[noteSkew.length]=i;
                                                }
                                            }
                        
                    }
                    else if(skew<0) //Making it more likely for higher notes to be played
                    {
                            for (i=0; i<Alength;i++){       //Iterating through all notes
                                                numSkew=Math.floor(1.15-skew*(1+Math.cos((i)*Math.PI*(1/Alength))));
                                                for(j=0; j<numSkew; j++)    //Adding number of notes of that type specified by cosine
                                                {
                                                    noteSkew[noteSkew.length]=i;
                                                }
                                            }
                    
                    }
                    else        //Otherwise set array 
                    {
                            for (i=0; i<Alength;i++){
                                noteSkew[noteSkew.length]=i;
                            }
                    }
                    return noteSkew;    //Return note skew array

}

function constArray(Array,Constant)     //Multiply an array by a constant
{
    for(i=0; i<Array.length; i++)
    {
        Array[i]=Array[i]*Constant;
    }
    return Array;

}

function ParameterChanged (param, value) {      //Function called when a UI parameter is changed
    switch(param)
    {
    case 1:
            SetParameter('Rand1', Math.floor((Math.random()*100)+1));                           //If randomise button pressed randomise seeded numbers
            SetParameter('Rand2', Math.floor((Math.random()*100)+1));
            SetParameter('Rand3', Math.floor((Math.random()*100)+1));
            randomNums= [GetParameter("Rand1"),GetParameter("Rand2"),GetParameter("Rand3")];
            SetParameter('Randomize', 0);               //Reset checkbox (so it acts like a push button)
    case 2:
            newMinMax=1;        //If min note length changed set new min max parameter for calculations
    case 3:
            newMinMax=1;        //If max note length changed set new min max parameter for calculations
    case 4:
            newMinMax=1;        //If dotted notes parameter changed set new min max parameter for calculations
    case 5:
            newMinMax=1;        //If triplet notes parameter changed set new min max parameter for calculations
    }
}


//Creating the UI Elements
var PluginParameters = [
{name:"Include Rests", defaultValue:0,type:"checkbox"},
{name:"Randomize", defaultValue:0,type:"checkbox"},
{name:"Min Note Length", type:"menu", valueStrings:["1/64","1/32","1/16", "1/8", "1/4", "1/2", "1"]},
{name:"Max Note Length",defaultValue:"1", type:"menu", valueStrings:["1/64","1/32","1/16", "1/8", "1/4", "1/2", "1"]},
{name:"Dotted Notes", defaultValue:0,type:"checkbox"},
{name:"Triplets", defaultValue:0,type:"checkbox"},
{name:"Note Pitch Skew", defaultValue:0, minValue:-10, maxValue:10,numberOfSteps:20,type:"lin"},
{name:"Note Length Skew", defaultValue:0, minValue:-10, maxValue:10,numberOfSteps:20,type:"lin"},
{name:"Rand1", defaultValue:1, minValue:1, maxValue:101, type:"linear"},
{name:"Rand2", defaultValue:1, minValue:1, maxValue:101, type:"linear"},
{name:"Rand3", defaultValue:1, minValue:1, maxValue:101, type:"linear"},
{name:"Remove Synth Slide", defaultValue:0,type:"checkbox"},
{name:"Output Notes To Terminal", defaultValue:0,type:"checkbox"}
];

